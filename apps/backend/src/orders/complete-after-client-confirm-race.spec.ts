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

describe('OrdersService.completeAfterClientConfirmation race', () => {
  const build = (lostRace: boolean) => {
    const svc: any = Object.create(OrdersService.prototype);
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    svc.getOrderDetails = jest.fn().mockResolvedValue({
      id: 'order-1',
      current_status: 'awaiting_client_confirmation',
      client: { user_id: 'client-user' },
      business_id: 'biz-1',
    });
    svc.processOrderPayment = jest.fn();
    svc.processOrderDeliveryPayment = jest.fn();
    svc.updateOrderStatusWithSingleRetry = jest.fn(
      async (_id: string, _s: string, options?: any) => {
        if (lostRace) options?.onSameStatusReplay?.();
        return { id: 'order-1', current_status: 'complete' };
      }
    );
    svc.createStatusHistoryEntry = jest.fn();
    svc.runCompletionSideEffects = jest.fn();
    return svc;
  };

  it('loser of confirm vs auto-complete skips settle and the tail', async () => {
    const svc = build(true);
    const result = await svc.completeAfterClientConfirmation(
      'order-1',
      'Client confirmed'
    );
    expect(result.alreadyComplete).toBe(true);
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
    expect(svc.processOrderDeliveryPayment).not.toHaveBeenCalled();
    expect(svc.runCompletionSideEffects).not.toHaveBeenCalled();
    expect(svc.createStatusHistoryEntry).not.toHaveBeenCalled();
  });

  it('winner settles only after winning the status CAS', async () => {
    const svc = build(false);
    const order: string[] = [];
    svc.updateOrderStatusWithSingleRetry = jest.fn(async () => {
      order.push('cas');
      return { id: 'order-1', current_status: 'complete' };
    });
    svc.processOrderPayment = jest.fn(async () => {
      order.push('item');
    });
    svc.processOrderDeliveryPayment = jest.fn(async () => {
      order.push('delivery');
    });

    await svc.completeAfterClientConfirmation('order-1', 'Client confirmed');

    expect(order).toEqual(['cas', 'item', 'delivery']);
    expect(svc.runCompletionSideEffects).toHaveBeenCalledTimes(1);
  });
});
