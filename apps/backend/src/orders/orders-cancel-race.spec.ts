/**
 * Unit tests for client order-cancel race condition fixes (#498)
 */

import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { OrderStatusService } from './order-status.service';
import { OrderQueueService } from './order-queue.service';
import { DepositRefundService } from './deposit-refund.service';
import { AccountsService } from '../accounts/accounts.service';

const ORDER_ID = 'order-1';
const CLIENT_USER_ID = 'client-user-1';

function mockUser(isClient = true) {
  return {
    id: CLIENT_USER_ID,
    active_persona: isClient ? 'client' : 'business',
    client: isClient ? { id: 'client-1', user_id: CLIENT_USER_ID } : null,
    business: isClient ? null : { id: 'business-1', user_id: CLIENT_USER_ID },
  };
}

function mockOrder(status = 'confirmed') {
  return {
    id: ORDER_ID,
    current_status: status,
    client_id: 'client-1',
    client: { user_id: CLIENT_USER_ID },
    business_id: 'business-1',
    business: { user_id: 'business-user-1' },
    assigned_agent_id: null,
    order_items: [{ id: 'item-1', business_inventory_id: 'inv-1', quantity: 2 }],
    currency: 'XAF',
    subtotal: 5000,
    payment_status: 'paid',
    payment_source: 'mobile_money',
  };
}

describe('Order cancel race condition (HIGH: compare-and-set)', () => {
  let service: OrdersService;
  let hasuraSystem: jest.Mocked<HasuraSystemService>;
  let hasuraUser: jest.Mocked<HasuraUserService>;
  let orderQueue: jest.Mocked<OrderQueueService>;
  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;
  let updateReservedQuantities: jest.SpyInstance;

  beforeEach(async () => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery,
            executeMutation,
            getAccount: jest.fn(),
            getRendasuaHQUser: jest.fn(),
          },
        },
        {
          provide: HasuraUserService,
          useValue: {
            getUser: jest.fn(),
          },
        },
        {
          provide: OrderStatusService,
          useValue: {
            updateOrderStatus: jest.fn(),
          },
        },
        {
          provide: OrderQueueService,
          useValue: {
            sendOrderCancelledMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DepositRefundService,
          useValue: {
            refundDeposit: jest.fn().mockResolvedValue({ success: true }),
            forfeitDeposit: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: AccountsService,
          useValue: {},
        },
        // Add minimal mocks for other required services
        { provide: 'CommissionsService', useValue: {} },
        { provide: 'StripeCaptureService', useValue: {} },
        { provide: 'DepositCalculationService', useValue: {} },
        { provide: 'MobilePaymentsDatabaseService', useValue: {} },
        { provide: 'OrderAcceptanceService', useValue: {} },
        { provide: 'OrderMarkReadyService', useValue: {} },
        { provide: 'OrderPickupMonitorService', useValue: {} },
        { provide: 'OrderOffersService', useValue: {} },
        { provide: 'DeliveryPinShareService', useValue: {} },
        { provide: 'OrderEventSourceService', useValue: {} },
        { provide: 'WaitAndExecuteScheduleService', useValue: {} },
        { provide: 'PurchaseCreditsService', useValue: {} },
        { provide: 'DepositLedgerService', useValue: {} },
        { provide: 'CommerceOrderInventoryHook', useValue: null },
        { provide: 'DeliveryReviewsHook', useValue: null },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    hasuraSystem = module.get(HasuraSystemService);
    hasuraUser = module.get(HasuraUserService);
    orderQueue = module.get(OrderQueueService);

    // Spy on private method
    updateReservedQuantities = jest
      .spyOn(service as any, 'updateReservedQuantities')
      .mockResolvedValue(undefined);

    hasuraUser.getUser.mockResolvedValue(mockUser(true));
  });

  it('only one concurrent cancel wins; losers get 409 with no side effects', async () => {
    const order = mockOrder('confirmed');
    executeQuery.mockResolvedValue({ orders: [order] });

    // First call: CAS succeeds (affected_rows = 1)
    executeMutation.mockResolvedValueOnce({
      update_orders: { affected_rows: 1 },
    });
    executeMutation.mockResolvedValue({}); // For metadata mutation

    const firstResult = await service.cancelOrder({
      orderId: ORDER_ID,
      cancellationReasonId: 1,
    });

    expect(firstResult.success).toBe(true);
    expect(updateReservedQuantities).toHaveBeenCalledWith(
      order.order_items,
      'decrement'
    );
    expect(orderQueue.sendOrderCancelledMessage).toHaveBeenCalledWith(
      ORDER_ID,
      'client',
      undefined,
      'confirmed',
      `order.cancelled:${ORDER_ID}`
    );

    // Second call: CAS fails (affected_rows = 0)
    executeMutation.mockClear();
    executeMutation.mockResolvedValueOnce({
      update_orders: { affected_rows: 0 },
    });
    updateReservedQuantities.mockClear();
    orderQueue.sendOrderCancelledMessage.mockClear();

    await expect(
      service.cancelOrder({
        orderId: ORDER_ID,
        cancellationReasonId: 1,
      })
    ).rejects.toThrow(
      new HttpException(
        'Order status has changed. The order may have already been cancelled or progressed to a non-cancellable state.',
        HttpStatus.CONFLICT
      )
    );

    // No side effects for the loser
    expect(updateReservedQuantities).not.toHaveBeenCalled();
    expect(orderQueue.sendOrderCancelledMessage).not.toHaveBeenCalled();
  });

  it('CAS checks current status against eligible list', async () => {
    const order = mockOrder('confirmed');
    executeQuery.mockResolvedValue({ orders: [order] });

    // CAS mutation should be called with eligibleFromStatuses
    executeMutation.mockResolvedValueOnce({
      update_orders: { affected_rows: 1 },
    });
    executeMutation.mockResolvedValue({});

    await service.cancelOrder({
      orderId: ORDER_ID,
      cancellationReasonId: 1,
    });

    const casMutation = executeMutation.mock.calls.find((call) =>
      String(call[0]).includes('CasCancelOrder')
    );
    expect(casMutation).toBeDefined();
    expect(casMutation?.[1]).toMatchObject({
      orderId: ORDER_ID,
      eligibleFromStatuses: expect.arrayContaining([
        'pending_payment',
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
      ]),
    });
  });
});

describe('Order cancel ledger duplicate key (MED: forfeit resume)', () => {
  let depositRefund: DepositRefundService;
  let hasuraSystem: jest.Mocked<HasuraSystemService>;
  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;

  beforeEach(async () => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositRefundService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery,
            executeMutation,
            getAccount: jest.fn().mockResolvedValue({
              id: 'account-1',
              available_balance: 1000,
            }),
            getRendasuaHQUser: jest.fn().mockResolvedValue({ id: 'hq-user' }),
          },
        },
        {
          provide: 'DepositCalculationService',
          useValue: {
            isAfterRefundLockPoint: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: 'DepositLedgerService',
          useValue: {
            forfeitDepositToHq: jest.fn(),
          },
        },
      ],
    }).compile();

    depositRefund = module.get<DepositRefundService>(DepositRefundService);
    hasuraSystem = module.get(HasuraSystemService);
  });

  it('treats duplicate ledger leg as complete when all legs exist', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 'ORD-001',
      current_status: 'cancelled',
      deposit_status: 'forfeited',
      deposit_forfeit_reason: 'customer_cancel_after_lock',
      deposit_amount: 500,
      deposit_mobile_payment_transaction_id: 'txn-1',
      client_user_id: CLIENT_USER_ID,
      currency: 'XAF',
    };

    // Mock getOrderWithDeposit to return the order
    executeQuery.mockResolvedValueOnce({ orders: [order] });

    // Mock the claim transition (already forfeited)
    // No executeMutation needed here since we're resuming

    // Forfeit ledger insert throws (duplicate key)
    const depositLedger = (depositRefund as any).depositLedgerService;
    depositLedger.forfeitDepositToHq.mockRejectedValueOnce(
      new Error('unique constraint violation')
    );

    // But ledger completeness check shows both release and payment exist
    executeQuery.mockResolvedValueOnce({
      account_transactions: [
        { transaction_type: 'release' },
        { transaction_type: 'payment' },
      ],
    });

    // Should not throw; treats as already complete
    const result = await depositRefund.forfeitDeposit(
      ORDER_ID,
      'customer_cancel_after_lock'
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('forfeited');
  });

  it('still fails when ledger incomplete and not a duplicate', async () => {
    const order = {
      id: ORDER_ID,
      order_number: 'ORD-002',
      current_status: 'cancelled',
      deposit_status: 'paid',
      deposit_amount: 500,
      deposit_mobile_payment_transaction_id: 'txn-2',
      client_user_id: CLIENT_USER_ID,
      currency: 'XAF',
    };

    executeQuery.mockResolvedValueOnce({ orders: [order] });

    // Mock successful claim
    executeMutation.mockResolvedValueOnce({
      update_orders: { affected_rows: 1 },
    });

    // Forfeit ledger fails with a non-duplicate error
    const depositLedger = (depositRefund as any).depositLedgerService;
    depositLedger.forfeitDepositToHq.mockRejectedValueOnce(
      new Error('some other error')
    );

    // Completeness check shows incomplete
    executeQuery.mockResolvedValueOnce({
      account_transactions: [{ transaction_type: 'release' }], // Only release, no payment
    });

    const result = await depositRefund.forfeitDeposit(
      ORDER_ID,
      'customer_cancel_after_lock'
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('FORFEIT_LEDGER_INCOMPLETE');
  });
});

describe('Order cancel event deduplication (LOW-MED)', () => {
  let service: OrdersService;
  let orderQueue: jest.Mocked<OrderQueueService>;
  let executeQuery: jest.Mock;
  let executeMutation: jest.Mock;

  beforeEach(async () => {
    executeQuery = jest.fn();
    executeMutation = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery,
            executeMutation,
          },
        },
        {
          provide: HasuraUserService,
          useValue: {
            getUser: jest.fn().mockResolvedValue(mockUser(true)),
          },
        },
        {
          provide: OrderQueueService,
          useValue: {
            sendOrderCancelledMessage: jest.fn().mockResolvedValue(undefined),
          },
        },
        // Minimal mocks
        { provide: OrderStatusService, useValue: {} },
        { provide: DepositRefundService, useValue: {} },
        { provide: AccountsService, useValue: {} },
        { provide: 'CommissionsService', useValue: {} },
        { provide: 'StripeCaptureService', useValue: {} },
        { provide: 'DepositCalculationService', useValue: {} },
        { provide: 'MobilePaymentsDatabaseService', useValue: {} },
        { provide: 'OrderAcceptanceService', useValue: {} },
        { provide: 'OrderMarkReadyService', useValue: {} },
        { provide: 'OrderPickupMonitorService', useValue: {} },
        { provide: 'OrderOffersService', useValue: {} },
        { provide: 'DeliveryPinShareService', useValue: {} },
        { provide: 'OrderEventSourceService', useValue: {} },
        { provide: 'WaitAndExecuteScheduleService', useValue: {} },
        { provide: 'PurchaseCreditsService', useValue: {} },
        { provide: 'DepositLedgerService', useValue: {} },
        { provide: 'CommerceOrderInventoryHook', useValue: null },
        { provide: 'DeliveryReviewsHook', useValue: null },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderQueue = module.get(OrderQueueService);

    jest
      .spyOn(service as any, 'updateReservedQuantities')
      .mockResolvedValue(undefined);
  });

  it('uses dedup id order.cancelled:<orderId> to prevent duplicate events', async () => {
    const order = mockOrder('confirmed');
    executeQuery.mockResolvedValue({ orders: [order] });
    executeMutation.mockResolvedValueOnce({
      update_orders: { affected_rows: 1 },
    });
    executeMutation.mockResolvedValue({});

    await service.cancelOrder({
      orderId: ORDER_ID,
      cancellationReasonId: 1,
    });

    expect(orderQueue.sendOrderCancelledMessage).toHaveBeenCalledWith(
      ORDER_ID,
      'client',
      undefined,
      'confirmed',
      `order.cancelled:${ORDER_ID}`
    );
  });
});

describe('Order cancel previous status (LOW)', () => {
  let service: OrdersService;
  let executeQuery: jest.Mock;

  beforeEach(async () => {
    executeQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery,
            executeMutation: jest.fn(),
          },
        },
        // Minimal mocks
        { provide: HasuraUserService, useValue: {} },
        { provide: OrderStatusService, useValue: {} },
        { provide: OrderQueueService, useValue: {} },
        { provide: DepositRefundService, useValue: {} },
        { provide: AccountsService, useValue: {} },
        { provide: 'CommissionsService', useValue: {} },
        { provide: 'StripeCaptureService', useValue: {} },
        { provide: 'DepositCalculationService', useValue: {} },
        { provide: 'MobilePaymentsDatabaseService', useValue: {} },
        { provide: 'OrderAcceptanceService', useValue: {} },
        { provide: 'OrderMarkReadyService', useValue: {} },
        { provide: 'OrderPickupMonitorService', useValue: {} },
        { provide: 'OrderOffersService', useValue: {} },
        { provide: 'DeliveryPinShareService', useValue: {} },
        { provide: 'OrderEventSourceService', useValue: {} },
        { provide: 'WaitAndExecuteScheduleService', useValue: {} },
        { provide: 'PurchaseCreditsService', useValue: {} },
        { provide: 'DepositLedgerService', useValue: {} },
        { provide: 'CommerceOrderInventoryHook', useValue: null },
        { provide: 'DeliveryReviewsHook', useValue: null },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('uses actual previous status from status history instead of hardcoding', async () => {
    const orderId = 'order-with-history';

    // Mock status history query to return 'preparing' as the previous status
    executeQuery.mockResolvedValueOnce({
      order_status_history: [{ status: 'preparing' }],
    });

    const previousStatus = await (service as any).getPreviousStatusBeforeCancelled(
      orderId
    );

    expect(previousStatus).toBe('preparing');
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('GetPreviousStatus'),
      { orderId }
    );
  });

  it('falls back to null when no previous status exists', async () => {
    const orderId = 'order-no-history';

    executeQuery.mockResolvedValueOnce({
      order_status_history: [],
    });

    const previousStatus = await (service as any).getPreviousStatusBeforeCancelled(
      orderId
    );

    expect(previousStatus).toBeNull();
  });
});
