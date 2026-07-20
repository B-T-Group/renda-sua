import { RefundPaymentService } from './refund-payment.service';
import type { RefundOrderContext } from './refund.types';

describe('RefundPaymentService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const destinationRouter = {
    resolve: jest.fn(),
  };
  const walletExecutor = {
    execute: jest.fn(),
  };
  const stripeRefundService = {
    initiatePostDeliveryRefund: jest.fn(),
  };
  const clawbackService = {
    clawbackItemSubtotal: jest.fn(),
  };

  const order: RefundOrderContext = {
    id: 'order-1',
    order_number: 'ORD-1',
    current_status: 'refund_requested',
    subtotal: 100,
    base_delivery_fee: 0,
    per_km_delivery_fee: 0,
    currency: 'USD',
    completed_at: '2026-07-10T00:00:00.000Z',
    client_id: 'client-1',
    business_id: 'business-1',
    business_location_id: null,
    payment_source: 'wallet',
    payment_status: 'paid',
    client: { user_id: 'client-user' },
    business: { user_id: 'business-user' },
  };

  let service: RefundPaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraSystemService.executeMutation.mockImplementation(
      (_mutation: string, variables: Record<string, unknown>) => {
        if ('object' in variables) {
          return Promise.resolve({
            insert_order_refund_payments_one: { id: 'payment-1' },
          });
        }
        return Promise.resolve({});
      }
    );
    service = new RefundPaymentService(
      hasuraSystemService as never,
      destinationRouter as never,
      walletExecutor as never,
      stripeRefundService as never,
      clawbackService as never
    );
  });

  it('creates a wallet refund payment and marks partial order payment status', async () => {
    destinationRouter.resolve.mockReturnValue('wallet');
    walletExecutor.execute.mockResolvedValue({
      success: true,
      paymentId: 'payment-1',
      destination: 'wallet',
      status: 'succeeded',
      async: false,
      message: 'Wallet credited',
    });
    hasuraSystemService.executeQuery
      .mockResolvedValueOnce({
        order_refund_payments_aggregate: { aggregate: { count: 0 } },
      })
      .mockResolvedValueOnce({ orders_by_pk: order });

    const result = await service.processPayment({
      refundRequestId: 'refund-1',
      order,
      amount: 40,
      refundType: 'post_delivery_partial',
      idempotencySuffix: 'approval',
    });

    expect(result).toMatchObject({ success: true, destination: 'wallet' });
    expect(walletExecutor.execute).toHaveBeenCalledWith({
      order,
      amount: 40,
      refundRequestId: 'refund-1',
      paymentId: 'payment-1',
    });
    expect(clawbackService.clawbackItemSubtotal).toHaveBeenCalledWith(order, 40);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertPayment'),
      {
        object: expect.objectContaining({
          refund_request_id: 'refund-1',
          order_id: 'order-1',
          destination: 'wallet',
          amount: 40,
          currency: 'USD',
          attempt: 1,
          idempotency_key: 'refund_payment_refund-1_1_approval',
        }),
      }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('PayStatus'),
      { id: 'order-1', ps: 'partially_refunded' }
    );
  });

  it('marks order refund failed when Stripe initiation fails', async () => {
    destinationRouter.resolve.mockReturnValue('stripe');
    stripeRefundService.initiatePostDeliveryRefund.mockResolvedValue({
      success: false,
      message: 'Stripe declined refund',
    });
    hasuraSystemService.executeQuery.mockResolvedValueOnce({
      order_refund_payments_aggregate: { aggregate: { count: 1 } },
    });

    const result = await service.processPayment({
      refundRequestId: 'refund-1',
      order: { ...order, payment_source: 'credit_card' },
      amount: 25,
      refundType: 'post_delivery_partial',
    });

    expect(result).toEqual({
      success: false,
      paymentId: 'payment-1',
      destination: 'stripe',
      status: 'failed',
      async: true,
      message: 'Stripe declined refund',
    });
    expect(stripeRefundService.initiatePostDeliveryRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        amount: 25,
        refundRequestId: 'refund-1',
        refundPaymentId: 'payment-1',
        refundType: 'post_delivery_partial',
        idempotencyKey: 'refund_payment_refund-1_2',
      })
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('Upd'),
      {
        id: 'payment-1',
        set: {
          status: 'failed',
          failure_reason: 'Stripe declined refund',
        },
      }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('S'),
      { id: 'order-1', status: 'refund_failed' }
    );
    expect(clawbackService.clawbackItemSubtotal).not.toHaveBeenCalled();
  });

  it('finalizes the order only after all Stripe refund payments succeed', async () => {
    const stripePayment = {
      id: 'payment-1',
      order_id: 'order-1',
      refund_request_id: 'refund-1',
      amount: 100,
    };
    hasuraSystemService.executeQuery
      .mockResolvedValueOnce({ order_refund_payments: [stripePayment] })
      .mockResolvedValueOnce({ orders_by_pk: order })
      .mockResolvedValueOnce({
        order_refund_payments: [{ amount: 100, status: 'succeeded' }],
      })
      .mockResolvedValueOnce({ orders_by_pk: order });

    await service.completeStripePayment('stripe-refund-1', true);

    expect(clawbackService.clawbackItemSubtotal).toHaveBeenCalledWith(order, 100);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('PayStatus'),
      { id: 'order-1', ps: 'refunded' }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('S'),
      { id: 'order-1', status: 'refunded' }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('FinalizeCase'),
      { id: 'refund-1' }
    );
  });
});
