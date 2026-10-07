jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

const REASON_ID = '22222222-2222-2222-2222-222222222222';

function readyOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'ORD-1',
    current_status: 'ready_for_pickup',
    payment_status: 'paid',
    payment_source: 'mobile_money',
    payment_timing: 'pay_at_pickup',
    pay_after_merchant_confirm: true,
    is_cooked_food_pickup: true,
    total_amount: 5000,
    currency: 'XAF',
    business_id: 'biz-1',
    fulfillment_method: 'pickup',
    assigned_agent_id: null,
    order_items: [{ is_cooked_food: true, quantity: 1 }],
    business_location: { address: { country: 'CM' } },
    ...overrides,
  };
}

function createHarness() {
  const executeQuery = jest.fn();
  const executeMutation = jest.fn().mockResolvedValue({});
  const updateOrderStatus = jest.fn().mockResolvedValue({
    id: 'order-1',
    current_status: 'failed',
  });
  const sendOrderCancelledMessage = jest.fn().mockResolvedValue(undefined);
  const restore = jest.fn().mockResolvedValue(undefined);
  const quoteNoshowFee = jest.fn().mockResolvedValue({
    cancellationFee: 500,
    refundAmount: 4500,
  });
  const cancelOrderPaymentIntent = jest.fn().mockResolvedValue({ success: true });
  const getOrderDetails = jest.fn();
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, {
    hasuraSystemService: { executeQuery, executeMutation },
    logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
    orderStatusService: { updateOrderStatus },
    orderQueueService: { sendOrderCancelledMessage },
    purchaseCreditsService: { restore },
    cancellationPolicyService: { quoteNoshowFee },
    stripeCaptureService: { cancelOrderPaymentIntent },
  });
  jest
    .spyOn(service as any, 'requireBusinessOrderAccess')
    .mockResolvedValue('user-biz');
  jest.spyOn(service as any, 'getOrderDetails').mockImplementation(getOrderDetails);
  jest.spyOn(service as any, 'updateReservedQuantities').mockResolvedValue(undefined);
  jest.spyOn(service as any, 'createStatusHistoryEntry').mockResolvedValue(undefined);
  const handleDepositOnCancellation = jest
    .spyOn(service as any, 'handleDepositOnCancellation')
    .mockResolvedValue(undefined);
  return {
    service,
    executeQuery,
    executeMutation,
    updateOrderStatus,
    sendOrderCancelledMessage,
    restore,
    quoteNoshowFee,
    cancelOrderPaymentIntent,
    getOrderDetails,
    handleDepositOnCancellation,
  };
}

function mockLookups(
  executeQuery: jest.Mock,
  existing: Record<string, unknown> | null,
  reason: { id: string; is_active: boolean } | null = {
    id: REASON_ID,
    is_active: true,
  }
) {
  executeQuery.mockImplementation(async (query: string) => {
    if (query.includes('FailedPickupByOrder')) {
      return { failed_pickups: existing ? [existing] : [] };
    }
    if (query.includes('ValidatePickupFailureReason')) {
      return { pickup_failure_reasons_by_pk: reason };
    }
    if (query.includes('PickupReadyAt')) {
      return {
        order_status_history: [
          { created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        ],
      };
    }
    if (query.includes('PickupNoshowHours')) {
      return { application_configurations: [{ country_code: null, number_value: 2 }] };
    }
    return {};
  });
}

function insertedPickup(executeMutation: jest.Mock) {
  const call = executeMutation.mock.calls.find((entry) =>
    String(entry[0]).includes('CreateFailedPickup')
  );
  return call?.[1]?.failedPickup;
}

describe('OrdersService.failPickup', () => {
  // Customer no-show uses the percent cancellation fee (same as a client cancel)
  // and is only allowed after the ready window. The harness treats the order as
  // ready 3 hours ago so the default 2-hour window is open.
  const request = { orderId: 'order-1', failure_reason_id: REASON_ID, notes: 'no show' };

  it('requires a failure reason before loading the order', async () => {
    const { service, getOrderDetails } = createHarness();

    await expect(
      service.failPickup({ orderId: 'order-1', failure_reason_id: '' })
    ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(getOrderDetails).not.toHaveBeenCalled();
  });

  it('returns the stored refund when the pickup is already failed', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(readyOrder({ current_status: 'failed' }));
    mockLookups(harness.executeQuery, {
      id: 'fp-1',
      refund_amount: 4500,
      fee_retained: 500,
    });

    await expect(harness.service.failPickup(request)).resolves.toMatchObject({
      success: true,
      refund_amount: 4500,
      fee_retained: 500,
      message: 'Pickup already marked as failed',
    });
    expect(harness.executeMutation).not.toHaveBeenCalled();
    expect(harness.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('repairs a failed order that never got a pickup record', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(
      readyOrder({ current_status: 'failed', total_amount: 2000 })
    );
    mockLookups(harness.executeQuery, null);
    harness.quoteNoshowFee.mockResolvedValue({
      cancellationFee: 200,
      refundAmount: 1800,
    });

    const result = await harness.service.failPickup(request);

    expect(result.refund_amount).toBe(1800);
    expect(result.fee_retained).toBe(200);
    expect(harness.quoteNoshowFee).toHaveBeenCalledWith(
      expect.objectContaining({ current_status: 'ready_for_pickup' })
    );
    expect(harness.updateOrderStatus).not.toHaveBeenCalled();
    expect(harness.sendOrderCancelledMessage).toHaveBeenCalledWith(
      'order-1',
      'business',
      'client_no_show',
      'ready_for_pickup',
      'order.cancelled:order-1'
    );
    expect(harness.handleDepositOnCancellation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
      'order-1',
      'ready_for_pickup',
      'business',
      'no show',
      'client_no_show'
    );
  });

  it('rejects unpaid, unready, retail, and agent-assigned delivery orders', async () => {
    const cases = [
      readyOrder({ payment_status: 'pending' }),
      readyOrder({ current_status: 'preparing' }),
      readyOrder({
        is_cooked_food_pickup: false,
        pay_after_merchant_confirm: false,
        order_items: [{ is_cooked_food: false }],
      }),
      readyOrder({
        fulfillment_method: 'delivery',
        assigned_agent_id: 'agent-1',
      }),
    ];

    for (const order of cases) {
      const harness = createHarness();
      harness.getOrderDetails.mockResolvedValue(order);
      mockLookups(harness.executeQuery, null);
      await expect(harness.service.failPickup(request)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(harness.executeMutation).not.toHaveBeenCalled();
    }
  });

  it('rejects a missing or inactive failure reason', async () => {
    for (const reason of [null, { id: REASON_ID, is_active: false }]) {
      const harness = createHarness();
      harness.getOrderDetails.mockResolvedValue(readyOrder());
      mockLookups(harness.executeQuery, null, reason);
      await expect(harness.service.failPickup(request)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(harness.executeMutation).not.toHaveBeenCalled();
    }
  });

  it('keeps the cancellation fee and refunds the rest for a paid cooked-food pickup', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(
      readyOrder({ delivery_fee_waived: true, base_delivery_fee: 500 })
    );
    mockLookups(harness.executeQuery, null);

    const result = await harness.service.failPickup(request);

    expect(result).toMatchObject({
      success: true,
      refund_amount: 4500,
      fee_retained: 500,
      message: 'Pickup marked as failed',
    });
    expect(insertedPickup(harness.executeMutation)).toEqual({
      order_id: 'order-1',
      business_id: 'biz-1',
      reason_id: REASON_ID,
      notes: 'no show',
      status: 'completed',
      refund_amount: 4500,
      fee_retained: 500,
      currency: 'XAF',
      fulfillment_method: 'pickup',
    });
    expect(harness.quoteNoshowFee).toHaveBeenCalledWith(
      expect.objectContaining({
        business_location: { country_code: 'CM' },
        payment_status: 'paid',
        delivery_fee_waived: true,
        base_delivery_fee: 500,
      })
    );
    expect(harness.updateOrderStatus).toHaveBeenCalledWith('order-1', 'failed', {
      viaFailPickupEndpoint: true,
    });
    expect(harness.sendOrderCancelledMessage).toHaveBeenCalledWith(
      'order-1',
      'business',
      'client_no_show',
      'ready_for_pickup',
      'order.cancelled:order-1'
    );
    expect(harness.handleDepositOnCancellation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'order-1',
        current_status: 'ready_for_pickup',
      }),
      'order-1',
      'ready_for_pickup',
      'business',
      'no show',
      'client_no_show'
    );
    expect(harness.restore).toHaveBeenCalledWith('order-1');
    expect(harness.cancelOrderPaymentIntent).not.toHaveBeenCalled();
  });

  it('fails a delivery handoff before an agent is assigned, using the line snapshot', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(
      readyOrder({
        fulfillment_method: 'delivery',
        is_cooked_food_pickup: false,
        pay_after_merchant_confirm: false,
        order_items: [{ is_cooked_food: true }],
        business_location: { country_code: 'GA' },
      })
    );
    mockLookups(harness.executeQuery, null);
    harness.quoteNoshowFee.mockResolvedValue({
      cancellationFee: 0,
      refundAmount: 5000,
    });

    const result = await harness.service.failPickup({
      orderId: 'order-1',
      failure_reason_id: REASON_ID,
    });

    expect(result.refund_amount).toBe(5000);
    expect(result.fee_retained).toBe(0);
    expect(insertedPickup(harness.executeMutation).notes).toBeNull();
    expect(harness.quoteNoshowFee).toHaveBeenCalledWith(
      expect.objectContaining({
        business_location: { country_code: 'GA' },
      })
    );
  });

  it('releases a card authorization and floors the refund at zero', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(
      readyOrder({
        payment_source: 'credit_card',
        payment_status: 'authorized',
        total_amount: 400,
      })
    );
    mockLookups(harness.executeQuery, null);
    harness.quoteNoshowFee.mockResolvedValue({
      cancellationFee: 500,
      refundAmount: 0,
    });

    const result = await harness.service.failPickup(request);

    expect(result.refund_amount).toBe(0);
    expect(result.fee_retained).toBe(500);
    expect(harness.cancelOrderPaymentIntent).toHaveBeenCalledWith({
      orderNumber: 'ORD-1',
      orderId: 'order-1',
    });
  });

  it('rolls back the pickup row when the status update fails', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(readyOrder());
    mockLookups(harness.executeQuery, null);
    harness.updateOrderStatus.mockRejectedValue(new Error('status write failed'));

    await expect(harness.service.failPickup(request)).rejects.toThrow(
      'status write failed'
    );
    expect(
      harness.executeMutation.mock.calls.some((call) =>
        String(call[0]).includes('DeleteFailedPickup')
      )
    ).toBe(true);
    expect(harness.sendOrderCancelledMessage).not.toHaveBeenCalled();
  });

  it('rejects a no-show before the order has been ready for the configured hours', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(readyOrder());
    harness.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('FailedPickupByOrder')) return { failed_pickups: [] };
      if (query.includes('PickupReadyAt')) {
        return { order_status_history: [{ created_at: new Date().toISOString() }] };
      }
      if (query.includes('PickupNoshowHours')) {
        return { application_configurations: [{ number_value: 2 }] };
      }
      return {};
    });

    await expect(harness.service.failPickup(request)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    });
    expect(harness.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('still succeeds when the refund enqueue fails', async () => {
    const harness = createHarness();
    harness.getOrderDetails.mockResolvedValue(readyOrder());
    mockLookups(harness.executeQuery, null);
    harness.sendOrderCancelledMessage.mockRejectedValue(new Error('queue down'));

    await expect(harness.service.failPickup(request)).resolves.toMatchObject({
      success: true,
      refund_amount: 4500,
    });
  });
});
