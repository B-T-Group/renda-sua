import { StripeRefundService } from './stripe-refund.service';

describe('StripeRefundService cancel uncaptured authorization', () => {
  let service: StripeRefundService;
  let stripeService: {
    retrievePaymentIntent: jest.Mock;
    createRefund: jest.Mock;
    cancelPaymentIntent: jest.Mock;
  };
  let databaseService: {
    getTransactionByEntityId: jest.Mock;
    updateTransaction: jest.Mock;
    sumSucceededRefundsForOrder: jest.Mock;
    createRefundRecord: jest.Mock;
    linkStripeRefundRecord: jest.Mock;
  };

  beforeEach(() => {
    stripeService = {
      retrievePaymentIntent: jest.fn(),
      createRefund: jest.fn(),
      cancelPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_123' }),
    };
    databaseService = {
      getTransactionByEntityId: jest.fn(),
      updateTransaction: jest.fn().mockResolvedValue(undefined),
      sumSucceededRefundsForOrder: jest.fn().mockResolvedValue(0),
      createRefundRecord: jest.fn(),
      linkStripeRefundRecord: jest.fn(),
    };
    service = new StripeRefundService(
      stripeService as never,
      databaseService as never
    );
  });

  function authorizedTx(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tx-1',
      amount: 5000,
      currency: 'CAD',
      status: 'authorized',
      stripe_payment_intent_id: 'pi_123',
      ...overrides,
    };
  }

  it('cancels an authorized PaymentIntent on order cancellation instead of refunding', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(authorizedTx());

    await expect(
      service.initiateOrderRefund({
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        cancellationFee: 0,
        cancelledBy: 'system',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Payment authorization released (no charge was made)',
    });

    expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'cancel_refund_order-1'
    );
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-1', {
      status: 'cancelled',
      error_message: 'Authorization cancelled on order cancellation',
    });
    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it('cancels capture_pending authorizations on cancellation', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      authorizedTx({ status: 'capture_pending' })
    );

    await expect(
      service.initiateOrderRefund({
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        cancellationFee: 0,
        cancelledBy: 'system',
      })
    ).resolves.toMatchObject({ success: true });

    expect(stripeService.cancelPaymentIntent).toHaveBeenCalled();
    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it('rejects post-delivery refunds against uncaptured authorizations', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(authorizedTx());

    await expect(
      service.initiatePostDeliveryRefund({
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        amount: 5000,
        refundRequestId: 'rr-1',
        refundPaymentId: 'rp-1',
        refundType: 'post_delivery_full',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      success: false,
      message: 'Cannot post-delivery refund an uncaptured authorization',
    });

    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it('cancels when DB status drifted but Stripe PI still requires_capture', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      authorizedTx({ status: 'success' })
    );
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'requires_capture',
    });

    await expect(
      service.initiateOrderRefund({
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        cancellationFee: 0,
        cancelledBy: 'system',
      })
    ).resolves.toMatchObject({
      success: true,
      message: 'Payment authorization released (no charge was made)',
    });

    expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'cancel_refund_order-1'
    );
    expect(stripeService.createRefund).not.toHaveBeenCalled();
  });

  it('treats an already-canceled PaymentIntent as a successful release', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      authorizedTx({ status: 'success' })
    );
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'canceled',
    });

    await expect(
      service.initiateOrderRefund({
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        cancellationFee: 0,
        cancelledBy: 'system',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Payment authorization already released',
    });

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-1', {
      status: 'cancelled',
      error_message: 'PaymentIntent already canceled on Stripe',
    });
    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
  });

  it('falls back to cancel when Stripe rejects a refund as uncaptured', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      authorizedTx({ status: 'success' })
    );
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
    });
    databaseService.createRefundRecord.mockResolvedValue({ id: 'refund-db-1' });
    stripeService.createRefund.mockRejectedValue(
      new Error('You cannot refund an uncaptured charge. Cancel the PaymentIntent instead.')
    );

    await expect(
      service.initiateOrderRefund({
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        cancellationFee: 0,
        cancelledBy: 'system',
      })
    ).resolves.toMatchObject({
      success: true,
      message: 'Payment authorization released (no charge was made)',
    });

    expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'cancel_refund_order-1'
    );
  });
});
