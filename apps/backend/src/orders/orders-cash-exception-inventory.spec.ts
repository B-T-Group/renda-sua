import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { AccountsService } from '../accounts/accounts.service';
import { OrderStatusService } from './order-status.service';
import { OrderQueueService } from './order-queue.service';
import { OrdersService } from './orders.service';

jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../notifications/orchestration/channels/email.channel', () => ({
  EmailChannel: class EmailChannel {},
}));

describe('OrdersService cash-exception inventory', () => {
  let service: OrdersService;
  let hasuraUserService: { getUser: jest.Mock; sessionPersonaContext: jest.Mock };
  let hasuraSystemService: {
    executeMutation: jest.Mock;
    executeQuery: jest.Mock;
    getAccount: jest.Mock;
  };

  const agentUser = {
    id: 'agent-user',
    active_persona: 'agent',
    agent: { id: 'agent-123', user_id: 'agent-user' },
  };

  const cashOrder = {
    id: 'order-123',
    order_number: '49520979',
    currency: 'XAF',
    assigned_agent_id: 'agent-123',
    assigned_agent: { user_id: 'agent-user' },
    client: { user_id: 'client-user' },
    payment_timing: 'pay_at_delivery',
    current_status: 'out_for_delivery',
    reconciliation_status: null,
    order_items: [
      { business_inventory_id: 'inv-1', quantity: 2 },
      { business_inventory_id: 'inv-2', quantity: 1 },
    ],
  };

  beforeEach(async () => {
    hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(agentUser),
      sessionPersonaContext: jest.fn().mockReturnValue({
        jwtDefaultRole: 'agent',
        jwtAllowedRoles: ['agent'],
      }),
    };
    hasuraSystemService = {
      executeMutation: jest.fn().mockResolvedValue({}),
      executeQuery: jest.fn().mockResolvedValue({}),
      getAccount: jest.fn().mockResolvedValue({ id: 'acct-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: HasuraUserService, useValue: hasuraUserService },
        { provide: HasuraSystemService, useValue: hasuraSystemService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: AccountsService, useValue: { registerTransaction: jest.fn() } },
        {
          provide: OrderStatusService,
          useValue: { creditReferralAfterCompletedDelivery: jest.fn() },
        },
        {
          provide: OrderQueueService,
          useValue: { sendOrderCompletedMessage: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    })
      .useMocker(() => ({}))
      .compile();

    service = module.get(OrdersService);
    (service as any).representativeCompensationService = {
      evaluateForOrderSafe: jest.fn(),
    };
    jest.spyOn(service as any, 'createStatusHistoryEntry').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'handleOrderCompletionRewards').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'sendRateAgentPromptToClient').mockResolvedValue(undefined);
  });

  function stubOrder(overrides: Record<string, unknown> = {}) {
    jest.spyOn(service as any, 'getOrderDetails').mockResolvedValue({
      ...cashOrder,
      ...overrides,
    });
  }

  function inventoryCalls() {
    return hasuraSystemService.executeQuery.mock.calls.filter(([query]) =>
      String(query).includes('UpdateInventoryOnCompletion')
    );
  }

  it('decrements reserved and on-hand quantity when cash exception completes', async () => {
    stubOrder();

    await expect(service.markPaidInCashException('order-123')).resolves.toEqual({
      success: true,
      message: 'Cash exception recorded',
    });

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('MarkCashException'),
      expect.objectContaining({ orderId: 'order-123', agentId: 'agent-123' })
    );
    expect(inventoryCalls()).toEqual([
      [
        expect.stringContaining('UpdateInventoryOnCompletion'),
        { id: 'inv-1', reservedQuantity: -2, quantity: -2 },
      ],
      [
        expect.stringContaining('UpdateInventoryOnCompletion'),
        { id: 'inv-2', reservedQuantity: -1, quantity: -1 },
      ],
    ]);
  });

  it('does not decrement inventory again when cash exception is already recorded', async () => {
    stubOrder({ reconciliation_status: 'pending_manual_reconciliation' });

    await expect(service.markPaidInCashException('order-123')).resolves.toEqual({
      success: true,
      message: 'Cash exception already recorded',
    });
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(inventoryCalls()).toEqual([]);
  });

  it('does not change inventory when the order is already reconciled', async () => {
    stubOrder({ reconciliation_status: 'reconciled' });

    await expect(service.markPaidInCashException('order-123')).resolves.toEqual({
      success: true,
      message: 'Order is already reconciled',
    });
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
    expect(inventoryCalls()).toEqual([]);
  });

  it('still records the cash exception when inventory update fails', async () => {
    stubOrder();
    hasuraSystemService.executeQuery.mockRejectedValue(new Error('hasura down'));

    await expect(service.markPaidInCashException('order-123')).resolves.toEqual({
      success: true,
      message: 'Cash exception recorded',
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalled();
  });

  it('rejects cash exception from a non-assigned agent', async () => {
    stubOrder({ assigned_agent_id: 'other-agent' });

    await expect(service.markPaidInCashException('order-123')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('applies a paid reservation deposit when cash exception completes', async () => {
    stubOrder({
      deposit_status: 'paid',
      deposit_amount: 2000,
      deposit_mobile_payment_transaction_id: 'dep-txn-1',
    });
    const apply = jest.fn().mockResolvedValue(undefined);
    (service as any).depositLedgerService = {
      applyHeldDepositAsPayment: apply,
    };

    await expect(service.markPaidInCashException('order-123')).resolves.toEqual({
      success: true,
      message: 'Cash exception recorded',
    });

    expect(hasuraSystemService.getAccount).toHaveBeenCalledWith(
      'client-user',
      'XAF'
    );
    expect(apply).toHaveBeenCalledWith({
      clientAccountId: 'acct-1',
      amount: 2000,
      orderNumber: '49520979',
      depositTransactionId: 'dep-txn-1',
    });
  });

  it('does not apply a deposit when cash exception has no captured deposit', async () => {
    stubOrder();
    const apply = jest.fn();
    (service as any).depositLedgerService = {
      applyHeldDepositAsPayment: apply,
    };

    await service.markPaidInCashException('order-123');

    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects cash exception unless the order is pay-at-delivery and out for delivery', async () => {
    stubOrder({ payment_timing: 'pay_now' });
    await expect(service.markPaidInCashException('order-123')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });

    stubOrder({ payment_timing: 'pay_at_delivery', current_status: 'pending' });
    await expect(service.markPaidInCashException('order-123')).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });
});
