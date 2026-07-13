import { RefundPaymentService } from './refund-payment.service';
import type { RefundOrderContext } from './refund.types';

describe('RefundPaymentService', () => {
  const paymentId = '00000000-0000-0000-0000-000000000003';
  const refundRequestId = '00000000-0000-0000-0000-000000000004';
  const stripeRefundDbId = '00000000-0000-0000-0000-000000000005';
  const order: RefundOrderContext = {
    id: '00000000-0000-0000-0000-000000000030',
    order_number: 'ORD-3',
    current_status: 'refund_processing',
    subtotal: 100,
    base_delivery_fee: 0,
    per_km_delivery_fee: 0,
    currency: 'XAF',
    completed_at: new Date().toISOString(),
    client_id: 'client-3',
    business_id: 'business-3',
    business_location_id: null,
    payment_source: 'credit_card',
    payment_status: 'paid',
    client: { user_id: 'client-user-3' },
    business: { user_id: 'business-user-3' },
  };

  const buildService = (paymentStatus: string) => {
    const hasuraSystem = {
      executeMutation: jest.fn().mockResolvedValue({}),
      executeQuery: jest.fn((query: string) => {
        if (query.includes('stripe_refund_id')) {
          return Promise.resolve({
            order_refund_payments: [
              {
                id: paymentId,
                order_id: order.id,
                refund_request_id: refundRequestId,
                amount: 25,
                status: paymentStatus,
              },
            ],
          });
        }
        if (query.includes('orders_by_pk')) {
          return Promise.resolve({ orders_by_pk: order });
        }
        if (query.includes('RefundPayments')) {
          return Promise.resolve({
            order_refund_payments: [{ amount: 25, status: 'processing' }],
          });
        }
        return Promise.resolve({});
      }),
    };
    const clawbackService = { clawbackItemSubtotal: jest.fn() };
    const service = new RefundPaymentService(
      hasuraSystem as never,
      {} as never,
      {} as never,
      {} as never,
      clawbackService as never
    );

    return { clawbackService, service };
  };

  it('does not claw back again when Stripe completion repeats', async () => {
    const { clawbackService, service } = buildService('succeeded');

    await service.completeStripePayment(stripeRefundDbId, true);

    expect(clawbackService.clawbackItemSubtotal).not.toHaveBeenCalled();
  });

  it('uses the refund payment id when clawing back a completed Stripe refund', async () => {
    const { clawbackService, service } = buildService('processing');

    await service.completeStripePayment(stripeRefundDbId, true);

    expect(clawbackService.clawbackItemSubtotal).toHaveBeenCalledWith(
      order,
      25,
      paymentId
    );
  });
});
