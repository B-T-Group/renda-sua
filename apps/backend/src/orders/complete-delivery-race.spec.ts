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

/** QA #560 F2 (parallel completion tail) and F6 (no completed_at rewrite). */
describe('OrdersService.completeDelivery race and completed_at', () => {
  const build = (lostRace: boolean) => {
    const svc: any = Object.create(OrdersService.prototype);
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    svc.hasuraUserService = {
      getUser: jest.fn().mockResolvedValue({ id: 'agent-user', active_persona: 'agent', agent: { id: 'agent-1' } }),
    };
    svc.requireActivePersona = jest.fn();
    svc.requireAgentRecord = jest.fn().mockReturnValue({ id: 'agent-1' });
    svc.getOrderDetails = jest.fn().mockResolvedValue({
      id: 'order-1',
      assigned_agent_id: 'agent-1',
      current_status: 'out_for_delivery',
      assigned_agent: { status: 'active' },
      delivery_overwrite_code_hash: 'hash',
      order_items: [{ id: 'item-1' }],
      client: { user_id: 'client-user' },
    });
    svc.deliveryPinService = {
      getMaxPinAttempts: jest.fn().mockReturnValue(5),
      verifyOverwriteCode: jest.fn().mockReturnValue(true),
      clearPinForOrder: jest.fn(),
    };
    svc.setOrderDeliveryOverwriteUsedAt = jest.fn();
    svc.processOrderDeliveryPayment = jest.fn();
    svc.orderStatusService = {
      updateOrderStatus: jest.fn(async (_id: string, _s: string, options?: any) => {
        if (lostRace) options?.onSameStatusReplay?.();
        return { id: 'order-1', current_status: 'complete', completed_at: '2026-10-13T12:00:00Z' };
      }),
    };
    svc.hasuraSystemService = { executeMutation: jest.fn(), executeQuery: jest.fn() };
    svc.createStatusHistoryEntry = jest.fn();
    svc.updateInventoryOnCompletion = jest.fn();
    svc.pdfService = { generateReceipt: jest.fn() };
    svc.orderQueueService = { sendOrderCompletedMessage: jest.fn() };
    svc.handleOrderCompletionRewards = jest.fn();
    svc.sendRateAgentPromptToClient = jest.fn();
    return svc;
  };

  const request = { orderId: 'order-1', overwriteCode: 'ABC123' } as any;

  it('loser of a parallel completion returns early with no tail side effects', async () => {
    const svc = build(true);

    const result = await svc.completeDelivery(request);

    expect(result.success).toBe(true);
    expect(svc.updateInventoryOnCompletion).not.toHaveBeenCalled();
    expect(svc.createStatusHistoryEntry).not.toHaveBeenCalled();
    expect(svc.pdfService.generateReceipt).not.toHaveBeenCalled();
    expect(svc.orderQueueService.sendOrderCompletedMessage).not.toHaveBeenCalled();
    expect(svc.handleOrderCompletionRewards).not.toHaveBeenCalled();
    expect(svc.sendRateAgentPromptToClient).not.toHaveBeenCalled();
    expect(svc.deliveryPinService.clearPinForOrder).not.toHaveBeenCalled();
  });

  it('winner runs the tail once and never rewrites completed_at', async () => {
    const svc = build(false);

    await svc.completeDelivery(request);

    expect(svc.updateInventoryOnCompletion).toHaveBeenCalledTimes(1);
    expect(svc.createStatusHistoryEntry).toHaveBeenCalledTimes(1);
    expect(svc.orderQueueService.sendOrderCompletedMessage).toHaveBeenCalledTimes(1);
    expect(svc.handleOrderCompletionRewards).toHaveBeenCalledTimes(1);
    const writes = svc.hasuraSystemService.executeMutation.mock.calls.map((c: any[]) => c[0]);
    expect(writes.some((m: string) => /completed_at/.test(m))).toBe(false);
    expect((OrdersService.prototype as any).setOrderCompletedAt).toBeUndefined();
  });

  it('passes the replay hook on the retry too', async () => {
    const svc = build(false);
    let call = 0;
    svc.orderStatusService.updateOrderStatus = jest.fn(async (_id: string, _s: string, options?: any) => {
      call += 1;
      if (call === 1) throw new Error('transient');
      options?.onSameStatusReplay?.();
      return { id: 'order-1', current_status: 'complete' };
    });

    await svc.completeDelivery(request);

    expect(svc.orderStatusService.updateOrderStatus).toHaveBeenCalledTimes(2);
    expect(svc.updateInventoryOnCompletion).not.toHaveBeenCalled();
  });
});
