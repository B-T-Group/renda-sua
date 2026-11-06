import { HttpException } from '@nestjs/common';
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

  it('does not settle a cash exception that is still pending reconciliation', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      current_status: 'awaiting_client_confirmation',
      client: { user_id: 'client-user' },
      reconciliation_status: 'pending_manual_reconciliation',
    });

    const result = await svc.completeAfterClientConfirmation(
      'order-1',
      'Client confirmed',
      'client'
    );

    expect(result.alreadyComplete).toBe(false);
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
    expect(svc.processOrderDeliveryPayment).not.toHaveBeenCalled();
    expect(svc.createStatusHistoryEntry).toHaveBeenCalledWith(
      'order-1',
      'complete',
      'Client confirmed',
      'client',
      'client-user'
    );
    expect(svc.runCompletionSideEffects).toHaveBeenCalledTimes(1);
  });

  it('still settles after the client confirms a reconciled order', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      current_status: 'awaiting_client_confirmation',
      client: { user_id: 'client-user' },
      reconciliation_status: 'reconciled',
    });

    await svc.completeAfterClientConfirmation('order-1', 'Client confirmed');

    expect(svc.processOrderPayment).toHaveBeenCalledWith('order-1');
    expect(svc.processOrderDeliveryPayment).toHaveBeenCalledWith('order-1');
  });

  it('refuses to complete an unpaid pay-at-delivery order', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      current_status: 'out_for_delivery',
      client: { user_id: 'client-user' },
      payment_timing: 'pay_at_delivery',
      payment_status: 'pending',
    });

    await expect(
      svc.completeAfterClientConfirmation('order-1', 'Client confirmed')
    ).rejects.toBeInstanceOf(HttpException);
    expect(svc.updateOrderStatusWithSingleRetry).not.toHaveBeenCalled();
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
  });

  it.each([
    ['paid', 'pay_at_delivery', undefined],
    ['authorized', 'pay_at_delivery', undefined],
    ['pending', 'pay_at_delivery', 'reconciled'],
  ])(
    'still settles a collected doorstep order (%s, recon %s)',
    async (payment_status, payment_timing, reconciliation_status) => {
      const svc = build(false);
      svc.getOrderDetails.mockResolvedValue({
        id: 'order-1',
        current_status: 'awaiting_client_confirmation',
        client: { user_id: 'client-user' },
        payment_timing,
        payment_status,
        reconciliation_status,
      });

      const result = await svc.completeAfterClientConfirmation(
        'order-1',
        'Client confirmed'
      );

      expect(result.alreadyComplete).toBe(false);
      expect(svc.processOrderPayment).toHaveBeenCalledWith('order-1');
      expect(svc.processOrderDeliveryPayment).toHaveBeenCalledWith('order-1');
    }
  );

  it('refuses paid mobile PAD when no successful collect exists', async () => {
    const svc = build(false);
    svc.mobilePaymentsDatabaseService = {
      hasSuccessfulOrderPayment: jest.fn().mockResolvedValue(false),
    };
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      order_number: 'ORD-1',
      current_status: 'awaiting_client_confirmation',
      client: { user_id: 'client-user' },
      payment_timing: 'pay_at_delivery',
      payment_status: 'paid',
      payment_source: 'mobile_payment',
      total_amount: 1500,
    });

    await expect(
      svc.completeAfterClientConfirmation('order-1', 'Client confirmed')
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ error: 'PAY_AT_DELIVERY_UNPAID' }),
    });
    expect(svc.updateOrderStatusWithSingleRetry).not.toHaveBeenCalled();
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
  });

  it('settles paid mobile PAD after a successful collect', async () => {
    const svc = build(false);
    svc.mobilePaymentsDatabaseService = {
      hasSuccessfulOrderPayment: jest.fn().mockResolvedValue(true),
    };
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      order_number: 'ORD-1',
      current_status: 'awaiting_client_confirmation',
      client: { user_id: 'client-user' },
      payment_timing: 'pay_at_delivery',
      payment_status: 'paid',
      payment_source: 'mobile_payment',
      total_amount: 1500,
    });

    const result = await svc.completeAfterClientConfirmation(
      'order-1',
      'Client confirmed'
    );

    expect(result.alreadyComplete).toBe(false);
    expect(svc.processOrderPayment).toHaveBeenCalledWith('order-1');
  });

  it('refuses pay-on-delivery when no payment status was recorded', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      current_status: 'out_for_delivery',
      client: { user_id: 'client-user' },
      payment_method: 'pay_on_delivery',
      payment_status: null,
    });

    await expect(
      svc.completeAfterClientConfirmation('order-1', 'Client confirmed')
    ).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ error: 'PAY_AT_DELIVERY_UNPAID' }),
    });
    expect(svc.updateOrderStatusWithSingleRetry).not.toHaveBeenCalled();
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
  });

  it('does not 409 a pay-at-delivery cash exception that is still pending reconciliation', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      current_status: 'awaiting_client_confirmation',
      client: { user_id: 'client-user' },
      payment_timing: 'pay_at_delivery',
      payment_status: 'pending',
      reconciliation_status: 'pending_manual_reconciliation',
    });

    const result = await svc.completeAfterClientConfirmation(
      'order-1',
      'Client confirmed'
    );

    expect(result.alreadyComplete).toBe(false);
    expect(svc.updateOrderStatusWithSingleRetry).toHaveBeenCalled();
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
    expect(svc.processOrderDeliveryPayment).not.toHaveBeenCalled();
  });

  it('does not settle when the order is already complete', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue({
      id: 'order-1',
      current_status: 'complete',
      client: { user_id: 'client-user' },
    });

    const result = await svc.completeAfterClientConfirmation('order-1', 'again');

    expect(result.alreadyComplete).toBe(true);
    expect(svc.updateOrderStatusWithSingleRetry).not.toHaveBeenCalled();
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
    expect(svc.createStatusHistoryEntry).not.toHaveBeenCalled();
  });

  it('does not settle when the order is missing', async () => {
    const svc = build(false);
    svc.getOrderDetails.mockResolvedValue(null);

    await expect(
      svc.completeAfterClientConfirmation('order-1', 'missing')
    ).rejects.toBeInstanceOf(HttpException);
    expect(svc.processOrderPayment).not.toHaveBeenCalled();
    expect(svc.updateOrderStatusWithSingleRetry).not.toHaveBeenCalled();
  });
});
