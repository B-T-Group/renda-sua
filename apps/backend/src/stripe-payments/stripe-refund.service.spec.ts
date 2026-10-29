import { StripeRefundService } from './stripe-refund.service';

describe('StripeRefundService cancel uncaptured authorization', () => {
  let service: StripeRefundService;
  let stripeService: {
    retrievePaymentIntent: jest.Mock;
    createRefund: jest.Mock;
    cancelPaymentIntent: jest.Mock;
  };
  let orderTaxLifecycle: {
    reverseForRefund: jest.Mock;
    voidForOrder: jest.Mock;
    resolveRefundTaxMode: jest.Mock;
  };
  let databaseService: {
    getTransactionByEntityId: jest.Mock;
    updateTransaction: jest.Mock;
    sumSucceededRefundPartsForOrder: jest.Mock;
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
      sumSucceededRefundPartsForOrder: jest.fn().mockResolvedValue({ amount: 0, taxAmount: 0 }),
      createRefundRecord: jest.fn(),
      linkStripeRefundRecord: jest.fn(),
    };
    orderTaxLifecycle = {
      reverseForRefund: jest.fn().mockResolvedValue(undefined),
      voidForOrder: jest.fn().mockResolvedValue(undefined),
      resolveRefundTaxMode: jest.fn().mockResolvedValue(false),
    };
    service = new StripeRefundService(
      stripeService as never,
      databaseService as never,
      orderTaxLifecycle as never
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

  describe('Stripe Tax reversal on refund', () => {
    const refundParams = {
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      cancellationFee: 0,
      cancelledBy: 'system' as const,
    };

    function capturedTx() {
      return authorizedTx({ status: 'success', amount: 113 });
    }

    beforeEach(() => {
      databaseService.getTransactionByEntityId.mockResolvedValue(capturedTx());
      stripeService.retrievePaymentIntent.mockResolvedValue({ status: 'succeeded' });
      databaseService.createRefundRecord.mockResolvedValue({ id: 'refund-db-1' });
    });

    it('reverses tax for a succeeded full refund using the refunded minor amount', async () => {
      stripeService.createRefund.mockResolvedValue({ id: 're_1', status: 'succeeded' });
      await expect(service.initiateOrderRefund(refundParams)).resolves.toMatchObject({
        success: true,
        refundId: 're_1',
        immediateSuccess: true,
      });
      expect(orderTaxLifecycle.reverseForRefund).toHaveBeenCalledWith({
        orderNumber: 'ORD-1',
        stripeRefundId: 're_1',
        refundAmountMinor: 11300,
      });
    });

    it('reverses the partial amount (cancellation fee kept)', async () => {
      stripeService.createRefund.mockResolvedValue({ id: 're_2', status: 'succeeded' });
      await service.initiateOrderRefund({ ...refundParams, cancellationFee: 13 });
      expect(orderTaxLifecycle.reverseForRefund).toHaveBeenCalledWith(
        expect.objectContaining({ stripeRefundId: 're_2', refundAmountMinor: 10000 })
      );
    });

    it('leaves a pending refund to the refund webhook', async () => {
      stripeService.createRefund.mockResolvedValue({ id: 're_3', status: 'pending' });
      await service.initiateOrderRefund(refundParams);
      expect(orderTaxLifecycle.reverseForRefund).not.toHaveBeenCalled();
    });

    it('does not reverse when Stripe rejects the refund', async () => {
      stripeService.createRefund.mockRejectedValue(new Error('card closed'));
      await service.initiateOrderRefund(refundParams);
      expect(orderTaxLifecycle.reverseForRefund).not.toHaveBeenCalled();
    });

    it('never blocks or changes the refund result when the reversal throws', async () => {
      stripeService.createRefund.mockResolvedValue({ id: 're_4', status: 'succeeded' });
      orderTaxLifecycle.reverseForRefund.mockRejectedValue(new Error('stripe tax down'));
      await expect(service.initiateOrderRefund(refundParams)).resolves.toEqual({
        success: true,
        refundId: 're_4',
        stripeRefundDbId: 'refund-db-1',
        immediateSuccess: true,
        message: 'Refund initiated: 113 CAD',
      });
    });

    it('legacy (pre-tax) orders: refund amount is capped by tx.amount minus prior refunds', async () => {
      databaseService.sumSucceededRefundPartsForOrder.mockResolvedValue({ amount: 100, taxAmount: 0 });
      stripeService.createRefund.mockResolvedValue({ id: 're_5', status: 'succeeded' });
      await service.initiateOrderRefund(refundParams);
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1300 })
      );
    });

    it('voids the estimate when an uncaptured authorization is released', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(authorizedTx());
      await service.initiateOrderRefund(refundParams);
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORD-1');
    });

    it('a void failure does not fail the authorization release', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(authorizedTx());
      orderTaxLifecycle.voidForOrder.mockRejectedValue(new Error('hasura'));
      await expect(service.initiateOrderRefund(refundParams)).resolves.toMatchObject({
        success: true,
      });
    });
  });
  describe('tax-inclusive refunds (finalized tax snapshot)', () => {
    const refundParams = {
      orderId: 'order-1',
      orderNumber: 'ORD-1',
      cancellationFee: 0,
      cancelledBy: 'system' as const,
    };

    beforeEach(() => {
      // Ledger 100.00 pre-tax, card charged 113.00 tax-inclusive.
      databaseService.getTransactionByEntityId.mockResolvedValue(
        authorizedTx({ status: 'success', amount: 100 })
      );
      stripeService.retrievePaymentIntent.mockResolvedValue({
        status: 'succeeded',
        amount_received: 11300,
      });
      orderTaxLifecycle.resolveRefundTaxMode.mockResolvedValue(true);
      databaseService.createRefundRecord.mockResolvedValue({ id: 'refund-db-1' });
      stripeService.createRefund.mockResolvedValue({ id: 're_1', status: 'succeeded' });
    });

    it('full refund returns ledger + tax to the card and reverses exactly that amount', async () => {
      await expect(service.initiateOrderRefund(refundParams)).resolves.toMatchObject({
        success: true,
        message: 'Refund initiated: 113 CAD (includes 13 tax)',
      });
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 11300 })
      );
      // stripe_refunds.amount keeps the ledger part, tax is stored separately.
      expect(databaseService.createRefundRecord).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, tax_refund_amount: 13 })
      );
      expect(orderTaxLifecycle.reverseForRefund).toHaveBeenCalledWith({
        orderNumber: 'ORD-1',
        stripeRefundId: 're_1',
        refundAmountMinor: 11300,
      });
    });

    it('partial refund (cancellation fee kept) returns a proportional tax share', async () => {
      await service.initiateOrderRefund({ ...refundParams, cancellationFee: 20 });
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9040 })
      );
      expect(databaseService.createRefundRecord).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 80, tax_refund_amount: 10.4 })
      );
      expect(orderTaxLifecycle.reverseForRefund).toHaveBeenCalledWith(
        expect.objectContaining({ refundAmountMinor: 9040 })
      );
    });

    it('the remaining refund takes ALL remaining tax (card refunds sum to the charge)', async () => {
      databaseService.sumSucceededRefundPartsForOrder.mockResolvedValue({
        amount: 80,
        taxAmount: 10.4,
      });
      await service.initiateOrderRefund(refundParams);
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2260 })
      );
      expect(databaseService.createRefundRecord).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 20, tax_refund_amount: 2.6 })
      );
    });

    it('nothing left to refund after a full refund', async () => {
      databaseService.sumSucceededRefundPartsForOrder.mockResolvedValue({ amount: 100, taxAmount: 13 });
      await expect(service.initiateOrderRefund(refundParams)).resolves.toMatchObject({
        success: true,
        message: expect.stringContaining('No refund needed'),
      });
      expect(stripeService.createRefund).not.toHaveBeenCalled();
    });

    it('FAILS CLOSED when the tax state cannot be read: no Stripe refund is attempted', async () => {
      orderTaxLifecycle.resolveRefundTaxMode.mockRejectedValue(new Error('hasura down'));
      const res = await service.initiateOrderRefund(refundParams);
      expect(res.success).toBe(false);
      expect(stripeService.createRefund).not.toHaveBeenCalled();
      expect(databaseService.createRefundRecord).not.toHaveBeenCalled();
    });

    it('legacy mode refunds the pre-tax amount only and records no tax part', async () => {
      orderTaxLifecycle.resolveRefundTaxMode.mockResolvedValue(false);
      await service.initiateOrderRefund(refundParams);
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10000 })
      );
      expect(databaseService.createRefundRecord).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, tax_refund_amount: 0 })
      );
    });

    it('keeps a zero-decimal currency in major units (lowercase xaf is not divided by 100)', async () => {
      databaseService.getTransactionByEntityId.mockResolvedValue(
        authorizedTx({ status: 'success', amount: 100, currency: 'xaf' })
      );
      stripeService.retrievePaymentIntent.mockResolvedValue({
        status: 'succeeded',
        amount_received: 113,
      });
      await expect(service.initiateOrderRefund(refundParams)).resolves.toMatchObject({
        success: true,
        message: 'Refund initiated: 113 xaf (includes 13 tax)',
      });
      expect(stripeService.createRefund).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 113 })
      );
      expect(databaseService.createRefundRecord).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 100, tax_refund_amount: 13, currency: 'xaf' })
      );
    });
  });
});
