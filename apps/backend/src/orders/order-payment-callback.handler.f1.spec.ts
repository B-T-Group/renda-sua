/**
 * QA #597 F1 (scoped): a MoMo/FedaPay failure on an `order` row only fails the order while it
 * is still waiting for that payment. The guard lives in the MoMo callback handler only; the
 * Stripe authorization reconciler and OrderSystemJobsService.onOrderPaymentFailed are unchanged.
 */
import {
  OrderPaymentCallbackHandler,
  isOrderAwaitingMomoPayment,
} from './order-payment-callback.handler';
import { OrderSystemJobsService } from './order-system-jobs.service';
import { StripeAuthReconcilerService } from '../stripe-payments/stripe-auth-reconciler.service';

const momoTx = (over: Record<string, unknown> = {}) =>
  ({
    id: 'tx-1',
    payment_entity: 'order',
    entity_id: 'ORD-1',
    reference: 'ORD-1-PAY',
    ...over,
  }) as any;

function handlerFor(order: Record<string, unknown>) {
  const ordersService: any = {
    getOrderForProcessingByNumber: jest.fn(async () => ({ id: 'order-uuid', order_number: 'ORD-1', ...order })),
    onOrderPaymentFailed: jest.fn(async () => undefined),
  };
  return { handler: new OrderPaymentCallbackHandler(ordersService), ordersService };
}

describe('isOrderAwaitingMomoPayment', () => {
  it.each([
    ['pending_payment', 'pending', true],
    ['confirmed', 'pending', true], // pay after merchant confirm
    ['ready_for_pickup', 'pending', true], // pay at pickup
    ['out_for_delivery', 'pending', true], // pay at delivery
    ['pending_payment', 'failed', true], // earlier attempt failed; the retry failed too
    ['cancelled', 'pending', false],
    ['failed', 'pending', false],
    ['refunded', 'pending', false],
    ['complete', 'pending', false],
    ['pending_payment', 'paid', false],
    ['out_for_delivery', 'paid', false],
    ['assigned_to_agent', 'authorized', false],
    ['pending_payment', 'cancelled', false],
    ['pending_payment', null, false],
  ])('status=%s payment_status=%s -> %s', (current_status, payment_status, expected) => {
    expect(isOrderAwaitingMomoPayment({ current_status, payment_status })).toBe(expected);
  });
});

describe('OrderPaymentCallbackHandler.onPaymentFailure for order rows (F1)', () => {
  it('fails a pay-now order still waiting for the payment', async () => {
    const { handler, ordersService } = handlerFor({ current_status: 'pending_payment', payment_status: 'pending' });
    await handler.onPaymentFailure(momoTx(), 'expired');
    expect(ordersService.onOrderPaymentFailed).toHaveBeenCalledWith('order-uuid', 'expired');
  });

  it('fails a pay-at-delivery order whose MoMo collection is still pending', async () => {
    const { handler, ordersService } = handlerFor({ current_status: 'out_for_delivery', payment_status: 'pending' });
    await handler.onPaymentFailure(momoTx(), 'declined');
    expect(ordersService.onOrderPaymentFailed).toHaveBeenCalledWith('order-uuid', 'declined');
  });

  it('does nothing (no push, email, timeout or state change) when the order was already cancelled', async () => {
    const { handler, ordersService } = handlerFor({ current_status: 'cancelled', payment_status: 'pending' });
    await handler.onPaymentFailure(momoTx(), 'expired');
    expect(ordersService.onOrderPaymentFailed).not.toHaveBeenCalled();
  });

  it('does nothing when the order is already paid', async () => {
    const { handler, ordersService } = handlerFor({ current_status: 'confirmed', payment_status: 'paid' });
    await handler.onPaymentFailure(momoTx(), 'expired');
    expect(ordersService.onOrderPaymentFailed).not.toHaveBeenCalled();
  });
});

describe('Stripe reconciler path still fails orders (not routed through the F1 guard)', () => {
  it('handleStripeAuthorizationLapsed calls onOrderPaymentFailed for an assigned, authorized card order', async () => {
    const hasura: any = {
      executeQuery: jest.fn(async () => ({
        orders: [{ id: 'order-card', order_number: 'ORD-C', current_status: 'assigned_to_agent', payment_status: 'authorized' }],
      })),
    };
    const jobs: any = { onOrderPaymentFailed: jest.fn(async () => undefined) };
    const reconciler = new StripeAuthReconcilerService(hasura, {} as any, {} as any, { get: () => ({}) } as any, jobs);
    await (reconciler as any).handleStripeAuthorizationLapsed('ORD-C');
    expect(jobs.onOrderPaymentFailed).toHaveBeenCalledWith('order-card', 'Payment authorization expired before pickup');
  });

  it('OrderSystemJobsService.onOrderPaymentFailed still marks an authorized assigned order failed and notifies', async () => {
    const executeMutation = jest.fn(async () => ({ update_orders_by_pk: { id: 'order-card' } }));
    const hasura: any = { executeMutation, executeQuery: jest.fn() };
    const schedule: any = { schedulePaymentTimeout: jest.fn(async () => undefined) };
    const notifications: any = {
      sendOrderPaymentFailedPush: jest.fn(async () => undefined),
      sendClientOrderPaymentFailedEmail: jest.fn(async () => undefined),
      sendClientPaymentFailedSms: jest.fn(async () => undefined),
      sendAgentOrderPaymentFailedEmail: jest.fn(async () => undefined),
    };
    const svc = new OrderSystemJobsService(
      hasura,
      {} as any,
      {} as any,
      {} as any,
      schedule,
      notifications,
      { get: () => 'https://dev.rendasua.com' } as any,
      {} as any,
      {} as any
    );
    jest.spyOn(svc as any, 'getOrderDetails').mockResolvedValue({
      id: 'order-card',
      order_number: 'ORD-C',
      current_status: 'assigned_to_agent',
      payment_status: 'authorized',
      payment_timing: 'pay_now',
      client: { user_id: 'u1', user: { email: 'c@example.com', first_name: 'C' } },
    });
    jest.spyOn(svc as any, 'createStatusHistoryEntry').mockResolvedValue(undefined);

    await svc.onOrderPaymentFailed('order-card', 'Payment authorization expired before pickup');

    const markCall = (executeMutation.mock.calls as any[]).find((c) => String(c[0]).includes('MarkOrderPaymentFailed'));
    expect(markCall).toBeDefined();
    expect(markCall[1]).toEqual(expect.objectContaining({ orderId: 'order-card', paymentStatus: 'failed' }));
    expect(schedule.schedulePaymentTimeout).toHaveBeenCalledWith('order.payment_failed', { order_id: 'order-card' }, 180);
    expect(notifications.sendOrderPaymentFailedPush).toHaveBeenCalled();
  });
});
