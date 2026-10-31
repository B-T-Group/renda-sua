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

  it('loser of confirm vs auto-complete skips the tail', async () => {
    const svc = build(true);
    const result = await svc.completeAfterClientConfirmation(
      'order-1',
      'Client confirmed'
    );
    expect(result.alreadyComplete).toBe(true);
    expect(svc.runCompletionSideEffects).not.toHaveBeenCalled();
    expect(svc.createStatusHistoryEntry).not.toHaveBeenCalled();
  });

  it('winner settles then runs the tail once', async () => {
    const svc = build(false);
    await svc.completeAfterClientConfirmation('order-1', 'Client confirmed');
    expect(svc.processOrderPayment).toHaveBeenCalledTimes(1);
    expect(svc.processOrderDeliveryPayment).toHaveBeenCalledTimes(1);
    expect(svc.runCompletionSideEffects).toHaveBeenCalledTimes(1);
  });
});
