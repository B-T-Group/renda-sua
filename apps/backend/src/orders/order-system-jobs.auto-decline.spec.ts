jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
import { OrderSystemJobsService } from './order-system-jobs.service';

describe('OrderSystemJobsService auto-decline claim race', () => {
  const orderId = 'order-1';
  const pendingOrder = {
    id: orderId,
    order_number: 'ORD-1',
    current_status: 'pending',
    payment_status: 'authorized',
    payment_source: 'credit_card',
    client: { user_id: 'client-user-1', user: {} },
    order_items: [{ business_inventory_id: 'inv-1', quantity: 1 }],
  };

  function buildService(overrides?: {
    claimAffectedRows?: number;
    order?: typeof pendingOrder | null;
  }) {
    const claimAffectedRows = overrides?.claimAffectedRows ?? 1;
    const order = overrides?.order === undefined ? pendingOrder : overrides.order;
    const executeMutation = jest.fn(async (mutation: string) => {
      if (mutation.includes('ClaimAutoDecline')) {
        return { update_orders: { affected_rows: claimAffectedRows } };
      }
      if (mutation.includes('PatchAutoDeclinePayment')) {
        return { update_orders_by_pk: { id: orderId } };
      }
      if (mutation.includes('UpdateReservedQuantity')) {
        return { update_business_inventory_by_pk: { id: 'inv-1' } };
      }
      return {};
    });
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('GetOrderForSystemJobs')) {
        return { orders_by_pk: order };
      }
      if (query.includes('GetCurrentReservedQuantities')) {
        return { business_inventory: [{ id: 'inv-1', reserved_quantity: 1 }] };
      }
      return {};
    });

    const hasuraSystemService = { executeMutation, executeQuery } as any;
    const stripeCaptureService = {
      cancelOrderPaymentIntent: jest.fn().mockResolvedValue({
        success: true,
        skipped: false,
      }),
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

    const service = new OrderSystemJobsService(
      hasuraSystemService,
      stripeCaptureService,
      stripeRefundService,
      orderQueueService,
      waitAndExecuteScheduleService,
      notificationsService,
      configService
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

  it('claims pending cancel before releasing Stripe authorization', async () => {
    const { service, executeMutation, stripeCaptureService, orderQueueService } =
      buildService({ claimAffectedRows: 1 });

    const declined = await service.autoDeclineUnacceptedOrderAsSystem(orderId);

    expect(declined).toBe(true);
    const claimIdx = executeMutation.mock.calls.findIndex((c) =>
      String(c[0]).includes('ClaimAutoDecline')
    );
    const patchIdx = executeMutation.mock.calls.findIndex((c) =>
      String(c[0]).includes('PatchAutoDeclinePayment')
    );
    expect(claimIdx).toBeGreaterThanOrEqual(0);
    expect(patchIdx).toBeGreaterThan(claimIdx);
    expect(stripeCaptureService.cancelOrderPaymentIntent).toHaveBeenCalled();
    expect(orderQueueService.sendOrderCancelledMessage).toHaveBeenCalled();
  });

  it('does not release payment when merchant confirm wins the race', async () => {
    const { service, stripeCaptureService, stripeRefundService, orderQueueService } =
      buildService({ claimAffectedRows: 0 });

    const declined = await service.autoDeclineUnacceptedOrderAsSystem(orderId);

    expect(declined).toBe(false);
    expect(stripeCaptureService.cancelOrderPaymentIntent).not.toHaveBeenCalled();
    expect(stripeRefundService.initiateOrderRefund).not.toHaveBeenCalled();
    expect(orderQueueService.sendOrderCancelledMessage).not.toHaveBeenCalled();
  });

  it('skips when order is no longer pending', async () => {
    const { service, stripeCaptureService, executeMutation } = buildService({
      order: { ...pendingOrder, current_status: 'confirmed' },
    });

    const declined = await service.autoDeclineUnacceptedOrderAsSystem(orderId);

    expect(declined).toBe(false);
    expect(stripeCaptureService.cancelOrderPaymentIntent).not.toHaveBeenCalled();
    expect(
      executeMutation.mock.calls.some((c) =>
        String(c[0]).includes('ClaimAutoDecline')
      )
    ).toBe(false);
  });
});
