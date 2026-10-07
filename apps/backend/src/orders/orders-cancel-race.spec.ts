/**
 * #498 QA follow-ups: client cancel race (CAS), forfeit dup-key ledger check,
 * order.cancelled dedup id. These exercise the real services with mocked I/O.
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentReferralsService } from '../agents/agent-referrals.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { DepositLedgerService, depositLedgerKey } from './deposit-ledger.service';
import { DepositRefundService } from './deposit-refund.service';
import { OrderQueueService } from './order-queue.service';
import { OrderStatusService } from './order-status.service';

describe('Client cancel compare-and-set (OrderStatusService)', () => {
  let service: OrderStatusService;
  let hasura: { executeQuery: jest.Mock; executeMutation: jest.Mock };
  let queue: { sendOrderStatusUpdatedMessage: jest.Mock };

  const clientUser = {
    id: 'user-client-1',
    active_persona: 'client',
    client: { id: 'client-1' },
  };
  const order = (current_status: string) => ({
    id: 'order-1',
    order_number: 'ORD-1',
    current_status,
    business_id: 'business-1',
    business: { user_id: 'user-business-1' },
    assigned_agent_id: null,
    assigned_agent: null,
    client_id: 'client-1',
    client: { user_id: 'user-client-1' },
  });

  beforeEach(async () => {
    hasura = { executeQuery: jest.fn(), executeMutation: jest.fn() };
    queue = { sendOrderStatusUpdatedMessage: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderStatusService,
        { provide: HasuraSystemService, useValue: hasura },
        {
          provide: HasuraUserService,
          useValue: { getUser: jest.fn().mockResolvedValue(clientUser) },
        },
        { provide: OrderQueueService, useValue: queue },
        {
          provide: AgentReferralsService,
          useValue: { creditAfterFirstDelivery: jest.fn() },
        },
        {
          provide: PaymentRoutingService,
          useValue: { getUserCountryCode: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(OrderStatusService);
  });

  const expectConflict = async (p: Promise<unknown>) => {
    await expect(p).rejects.toBeInstanceOf(HttpException);
    await p.catch((e: HttpException) =>
      expect(e.getStatus()).toBe(HttpStatus.CONFLICT)
    );
  };

  it.each(['pending_payment', 'pending', 'confirmed', 'preparing', 'ready_for_pickup'])(
    'winner from %s: one conditional update on that status and one status event',
    async (status) => {
      hasura.executeQuery.mockResolvedValue({ orders_by_pk: order(status) });
      hasura.executeMutation.mockResolvedValue({
        update_orders: {
          affected_rows: 1,
          returning: [{ ...order('cancelled') }],
        },
      });

      await service.updateOrderStatus('order-1', 'cancelled', undefined, {
        viaCancelEndpoint: true,
        expectedFromStatus: status,
      });

      expect(hasura.executeMutation).toHaveBeenCalledTimes(1);
      expect(hasura.executeMutation.mock.calls[0][1]).toEqual(
        expect.objectContaining({ previousStatus: status, newStatus: 'cancelled' })
      );
      expect(queue.sendOrderStatusUpdatedMessage).toHaveBeenCalledTimes(1);
    }
  );

  it('loser that reads an already-cancelled order gets 409 with no write and no event', async () => {
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: order('cancelled') });

    await expectConflict(
      service.updateOrderStatus('order-1', 'cancelled', undefined, {
        viaCancelEndpoint: true,
        expectedFromStatus: 'ready_for_pickup',
      })
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
    expect(queue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
  });

  it('cancelled → cancelled is refused even without an expected status', async () => {
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: order('cancelled') });

    await expectConflict(
      service.updateOrderStatus('order-1', 'cancelled', undefined, {
        viaCancelEndpoint: true,
      })
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('order moved off the validated status (e.g. picked up) → 409, no write', async () => {
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: order('preparing') });

    await expectConflict(
      service.updateOrderStatus('order-1', 'cancelled', undefined, {
        viaCancelEndpoint: true,
        expectedFromStatus: 'confirmed',
      })
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('loser of the conditional update (0 rows) gets 409 and no event', async () => {
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: order('ready_for_pickup') });
    hasura.executeMutation.mockResolvedValue({
      update_orders: { affected_rows: 0, returning: [] },
    });

    await expectConflict(
      service.updateOrderStatus('order-1', 'cancelled', undefined, {
        viaCancelEndpoint: true,
        expectedFromStatus: 'ready_for_pickup',
      })
    );
    expect(queue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
  });
});

describe('Forfeit ledger dup-key handling (DepositRefundService)', () => {
  const orderId = 'order-1';
  const txnId = 'txn-1';
  let service: DepositRefundService;
  let hasura: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
    getAccount: jest.Mock;
  };
  let ledger: { forfeitDepositToHq: jest.Mock; releaseDepositToAvailable: jest.Mock };
  let legsResponse: () => unknown;

  beforeEach(async () => {
    legsResponse = () => ({ account_transactions: [] });
    hasura = {
      executeQuery: jest.fn(async (query: string) => {
        if (query.includes('GetForfeitLegs')) return legsResponse();
        if (query.includes('DepositConsumedPayment'))
          return { account_transactions: [] };
        return {
          orders_by_pk: {
            id: orderId,
            order_number: '1',
            current_status: 'cancelled',
            fulfillment_method: 'pickup',
            currency: 'XAF',
            deposit_amount: 250,
            deposit_mobile_payment_transaction_id: txnId,
            deposit_status: 'paid',
            deposit_refund_status: 'none',
            client: { user_id: 'client-1' },
          },
        };
      }),
      executeMutation: jest
        .fn()
        .mockResolvedValue({ update_orders: { affected_rows: 1 } }),
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-1' }),
    };
    ledger = {
      forfeitDepositToHq: jest
        .fn()
        .mockRejectedValue(new Error('duplicate key value violates unique constraint')),
      releaseDepositToAvailable: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositRefundService,
        { provide: HasuraSystemService, useValue: hasura },
        {
          provide: DepositCalculationService,
          useValue: { isAfterRefundLockPoint: jest.fn().mockReturnValue(false) },
        },
        { provide: DepositLedgerService, useValue: ledger },
      ],
    }).compile();
    service = module.get(DepositRefundService);
  });

  const keys = (moves: Array<'release' | 'payment' | 'forfeit_hq'>) => ({
    account_transactions: moves.map((m) => ({
      idempotency_key: depositLedgerKey(txnId, m),
    })),
  });

  it('dup key but all three keyed legs exist → success (concurrent forfeit won)', async () => {
    legsResponse = () => keys(['release', 'payment', 'forfeit_hq']);
    const result = await service.forfeitDeposit(orderId, 'customer_cancel_after_lock');
    expect(result.success).toBe(true);
  });

  it('dup key with the HQ credit missing → still FORFEIT_LEDGER_INCOMPLETE', async () => {
    legsResponse = () => keys(['release', 'payment']);
    const result = await service.forfeitDeposit(orderId, 'customer_cancel_after_lock');
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('FORFEIT_LEDGER_INCOMPLETE');
  });

  it('dup key with only the release leg → FORFEIT_LEDGER_INCOMPLETE', async () => {
    legsResponse = () => keys(['release']);
    const result = await service.forfeitDeposit(orderId, 'customer_cancel_after_lock');
    expect(result.errorCode).toBe('FORFEIT_LEDGER_INCOMPLETE');
  });

  it('leg re-read failing → FORFEIT_LEDGER_INCOMPLETE (never a false success)', async () => {
    legsResponse = () => {
      throw new Error('hasura down');
    };
    const result = await service.forfeitDeposit(orderId, 'customer_cancel_after_lock');
    expect(result.errorCode).toBe('FORFEIT_LEDGER_INCOMPLETE');
  });

  it('re-reads by the three deposit idempotency keys', async () => {
    legsResponse = () => keys(['release', 'payment', 'forfeit_hq']);
    await service.forfeitDeposit(orderId, 'customer_cancel_after_lock');
    const call = hasura.executeQuery.mock.calls.find(([q]) =>
      String(q).includes('GetForfeitLegs')
    );
    expect(call?.[1]).toEqual({
      keys: [
        `deposit:${txnId}:release`,
        `deposit:${txnId}:payment`,
        `deposit:${txnId}:forfeit_hq`,
      ],
    });
  });
});

describe('order.cancelled dedup id (OrderQueueService, FIFO queue)', () => {
  const prev = process.env.ORDER_STATUS_QUEUE_URL;
  afterAll(() => {
    process.env.ORDER_STATUS_QUEUE_URL = prev;
  });

  it('sets MessageDeduplicationId and the per-order MessageGroupId', async () => {
    process.env.ORDER_STATUS_QUEUE_URL =
      'https://sqs.ca-central-1.amazonaws.com/1/order-status-changes-test.fifo';
    const service = new OrderQueueService({
      get: () => ({ region: 'ca-central-1' }),
    } as any);
    const send = jest.fn().mockResolvedValue({ MessageId: 'm1' });
    (service as any).sqsClient = { send };

    await service.sendOrderCancelledMessage(
      'order-1',
      'client',
      undefined,
      'ready_for_pickup',
      'order.cancelled:order-1'
    );

    const input = send.mock.calls[0][0].input;
    expect(input.MessageDeduplicationId).toBe('order.cancelled:order-1');
    expect(input.MessageGroupId).toBe('order-1');
  });
});
