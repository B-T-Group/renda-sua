jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
import { OrderSystemJobsService } from './order-system-jobs.service';
import { CANCEL_REASON_NOT_PICKED_UP_IN_TIME } from './order-cleanup.constants';

describe('OrderSystemJobsService stale authorized cancel', () => {
  const orderId = 'order-1';
  const staleOrder = {
    id: orderId,
    order_number: 'ORD-1',
    current_status: 'ready_for_pickup',
    payment_status: 'authorized',
    payment_source: 'credit_card',
    fulfillment_method: 'delivery',
    assigned_agent_id: null,
    client: { user_id: 'client-user-1', user: {} },
    order_items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
  };

  function buildService(overrides?: {
    claimAffectedRows?: number;
    order?: typeof staleOrder | null;
    stripeCancelResult?: { success: boolean; skipped: boolean; message?: string };
  }) {
    const claimAffectedRows = overrides?.claimAffectedRows ?? 1;
    const order = overrides?.order === undefined ? staleOrder : overrides.order;
    const executeMutation = jest.fn(async (mutation: string) => {
      if (mutation.includes('ClaimStaleAuthorizedCancel')) {
        return { update_orders: { affected_rows: claimAffectedRows } };
      }
      if (mutation.includes('PatchAutoDeclinePayment')) {
        return { update_orders_by_pk: { id: orderId } };
      }
      if (mutation.includes('try_release_business_inventory')) {
        return { try_release_business_inventory: [{ id: 'inv-1' }] };
      }
      return {};
    });
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('GetOrderForSystemJobs')) {
        return { orders_by_pk: order };
      }
      return {};
    });

    const hasuraSystemService = { executeMutation, executeQuery } as any;
    const stripeCaptureService = {
      cancelOrderPaymentIntent: jest.fn().mockResolvedValue(
        overrides?.stripeCancelResult ?? {
          success: true,
          skipped: false,
        }
      ),
    } as any;
    const stripeRefundService = {
      initiateOrderRefund: jest.fn(),
    } as any;
    const orderQueueService = {
      sendOrderCancelledMessage: jest.fn().mockResolvedValue(undefined),
    } as any;
    const waitAndExecuteScheduleService = {} as any;
    const notificationsService = {
      sendOrderAutoDeclinedPush: jest.fn().mockResolvedValue(undefined),
    } as any;
    const configService = { get: jest.fn() } as any;
    const orderCleanupService = {} as any;

    const service = new OrderSystemJobsService(
      hasuraSystemService,
      stripeCaptureService,
      stripeRefundService,
      orderQueueService,
      waitAndExecuteScheduleService,
      notificationsService,
      configService,
      orderCleanupService
    );

    return {
      service,
      executeMutation,
      stripeCaptureService,
      stripeRefundService,
      orderQueueService,
      notificationsService,
    };
  }

  it('sets cancellation_reason_id and cancelled_by when claiming stale authorized order', async () => {
    const { service, executeMutation, stripeCaptureService, orderQueueService } =
      buildService({ claimAffectedRows: 1 });

    await service.cancelStaleAuthorizedOrderAsSystem(orderId);

    // Find the claim mutation call
    const claimCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('ClaimStaleAuthorizedCancel')
    );

    expect(claimCall).toBeDefined();
    expect(claimCall![1]).toEqual({
      orderId,
      at: expect.any(String),
      reasonId: CANCEL_REASON_NOT_PICKED_UP_IN_TIME,
    });

    // Verify the mutation includes both cancellation_reason_id and cancelled_by in the _set
    const mutation = String(claimCall![0]);
    expect(mutation).toContain('cancellation_reason_id: $reasonId');
    expect(mutation).toContain('cancelled_by: "system"');
    expect(mutation).toContain('cancelled_at: $at');

    expect(stripeCaptureService.cancelOrderPaymentIntent).toHaveBeenCalled();
    expect(orderQueueService.sendOrderCancelledMessage).toHaveBeenCalledWith(
      orderId,
      'system',
      'Auto-cancelled: no agent claimed within timeout',
      'ready_for_pickup'
    );
  });

  it('does not cancel when order is not ready_for_pickup', async () => {
    const { service, executeMutation } = buildService({
      order: { ...staleOrder, current_status: 'pending' },
    });

    await service.cancelStaleAuthorizedOrderAsSystem(orderId);

    const claimCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('ClaimStaleAuthorizedCancel')
    );
    expect(claimCall).toBeUndefined();
  });

  it('does not cancel when order has assigned agent', async () => {
    const { service, executeMutation } = buildService({
      order: { ...staleOrder, assigned_agent_id: 'agent-1' },
    });

    await service.cancelStaleAuthorizedOrderAsSystem(orderId);

    const claimCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('ClaimStaleAuthorizedCancel')
    );
    expect(claimCall).toBeUndefined();
  });

  it('does not cancel when fulfillment_method is pickup', async () => {
    const { service, executeMutation } = buildService({
      order: { ...staleOrder, fulfillment_method: 'pickup' },
    });

    await service.cancelStaleAuthorizedOrderAsSystem(orderId);

    const claimCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('ClaimStaleAuthorizedCancel')
    );
    expect(claimCall).toBeUndefined();
  });

  it('reverts claim when payment release fails', async () => {
    const { service, executeMutation, stripeCaptureService } = buildService({
      claimAffectedRows: 1,
      stripeCancelResult: { success: false, skipped: false, message: 'Stripe error' },
    });

    await expect(
      service.cancelStaleAuthorizedOrderAsSystem(orderId)
    ).rejects.toThrow();

    // Verify claim was attempted
    const claimCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('ClaimStaleAuthorizedCancel')
    );
    expect(claimCall).toBeDefined();

    // Verify revert was called
    const revertCall = executeMutation.mock.calls.find((c) =>
      String(c[0]).includes('RevertSystemCancelClaim')
    );
    expect(revertCall).toBeDefined();
    expect(revertCall![1]).toEqual({
      orderId,
      previousStatus: 'ready_for_pickup',
    });
  });
});
