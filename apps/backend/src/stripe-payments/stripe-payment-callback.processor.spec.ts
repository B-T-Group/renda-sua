import type { Request } from 'express';
import type { StripePaymentTransaction } from './stripe-payments-database.service';
import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';

describe('StripePaymentCallbackProcessor', () => {
  const now = new Date('2026-07-06T10:00:00.000Z');
  const req = {} as Request;
  let processor: StripePaymentCallbackProcessor;
  let databaseService: {
    getTransactionByReference: jest.Mock;
    getTransactionBySessionId: jest.Mock;
    getTransactionByPaymentIntentId: jest.Mock;
    getTransactionById: jest.Mock;
    updateTransaction: jest.Mock;
  };
  let accountsService: {
    registerTransaction: jest.Mock;
    registerDepositIfNotExists: jest.Mock;
  };
  let callbackHandler: {
    supportsPaymentEntity: jest.Mock;
    finalizeCashReconciliationAfterPayment: jest.Mock;
    onPaymentSuccess: jest.Mock;
    onPaymentAuthorized: jest.Mock;
    onPaymentFailure: jest.Mock;
  };
  let paymentCallbackRegistry: {
    getHandlers: jest.Mock;
  };
  let stripeService: {
    retrievePaymentIntent: jest.Mock;
    retrieveTaxCalculation?: jest.Mock;
    createTaxTransactionFromCalculation?: jest.Mock;
  };
  let hasuraSystemService: {
    executeQuery: jest.Mock;
  };
  let taxOrderPersistence: { finalizeFromTaxCalculation: jest.Mock };
  let orderTaxLifecycle: {
    finalizeAfterCapture: jest.Mock;
    voidForOrder: jest.Mock;
    syncLegacyFinalized: jest.Mock;
    reverseForRefund: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    databaseService = {
      getTransactionByReference: jest.fn(),
      getTransactionBySessionId: jest.fn(),
      getTransactionByPaymentIntentId: jest.fn(),
      getTransactionById: jest.fn(),
      updateTransaction: jest.fn(),
    };
    accountsService = {
      registerTransaction: jest.fn(),
      registerDepositIfNotExists: jest.fn(),
    };
    callbackHandler = {
      supportsPaymentEntity: jest.fn((entity) => entity === 'order'),
      finalizeCashReconciliationAfterPayment: jest.fn(),
      onPaymentSuccess: jest.fn(),
      onPaymentAuthorized: jest.fn(),
      onPaymentFailure: jest.fn(),
    };
    paymentCallbackRegistry = {
      getHandlers: jest.fn().mockReturnValue([callbackHandler]),
    };
    stripeService = { retrievePaymentIntent: jest.fn() };
    hasuraSystemService = { executeQuery: jest.fn() };
    taxOrderPersistence = { finalizeFromTaxCalculation: jest.fn() };
    orderTaxLifecycle = {
      finalizeAfterCapture: jest.fn().mockResolvedValue(undefined),
      voidForOrder: jest.fn().mockResolvedValue(undefined),
      syncLegacyFinalized: jest.fn().mockResolvedValue(undefined),
      reverseForRefund: jest.fn().mockResolvedValue(undefined),
    };
    processor = new StripePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      stripeService as never,
      hasuraSystemService as never,
      taxOrderPersistence as never,
      orderTaxLifecycle as never
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function makeTransaction(
    overrides: Partial<StripePaymentTransaction> = {}
  ): StripePaymentTransaction {
    return {
      id: 'tx-123',
      reference: 'stripe-ref-123',
      amount: 125,
      currency: 'CAD',
      status: 'pending',
      transaction_type: 'PAYMENT',
      capture_method: 'manual',
      stripe_payment_intent_id: 'pi_123',
      stripe_session_id: 'cs_123',
      account_id: 'account-123',
      payment_entity: 'order',
      entity_id: 'ORDER-1001',
      customer_email: 'buyer@example.com',
      created_at: '2026-07-06T09:00:00.000Z',
      updated_at: '2026-07-06T09:00:00.000Z',
      ...overrides,
    };
  }

  it('marks manual checkout as authorized without crediting wallet', async () => {
    const tx = makeTransaction();
    databaseService.getTransactionByReference.mockResolvedValue(tx);
    stripeService.retrievePaymentIntent.mockResolvedValue({
      id: 'pi_123',
      status: 'requires_capture',
    });

    await processor.onCheckoutSessionCompleted(
      {
        id: 'cs_123',
        client_reference_id: 'stripe-ref-123',
        payment_intent: 'pi_123',
      } as never,
      req
    );

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'authorized',
      stripe_payment_intent_id: 'pi_123',
      authorized_at: now.toISOString(),
    });
    expect(callbackHandler.onPaymentAuthorized).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-123',
        provider: 'stripe',
        payment_entity: 'order',
        status: 'pending',
      })
    );
    expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(callbackHandler.onPaymentSuccess).not.toHaveBeenCalled();
  });

  it('finalizes authorized manual payments when the PaymentIntent succeeds', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      makeTransaction({ status: 'authorized' })
    );
    databaseService.getTransactionById.mockResolvedValue(
      makeTransaction({ status: 'success' })
    );
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
    });

    await processor.onPaymentIntentSucceeded(
      {
        id: 'pi_123',
        metadata: { reference: 'stripe-ref-123' },
      } as never,
      req
    );

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'success',
      stripe_payment_intent_id: 'pi_123',
      captured_at: now.toISOString(),
    });
    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 125,
      memo: 'Stripe payment deposit - stripe-ref-123',
      referenceId: 'tx-123',
      skipCashAdvanceRepayment: true,
    });
    expect(callbackHandler.onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-123', reference: 'stripe-ref-123' })
    );
    expect(callbackHandler.onPaymentFailure).not.toHaveBeenCalled();
  });

  it('leaves a claim-order capture pending when finalize throws', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      makeTransaction({ status: 'authorized', payment_entity: 'claim_order' })
    );
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
    });
    callbackHandler.supportsPaymentEntity.mockImplementation(
      (entity: string) => entity === 'claim_order'
    );
    callbackHandler.onPaymentSuccess.mockRejectedValue(new Error('claim assign failed'));

    await expect(
      processor.onPaymentIntentSucceeded(
        { id: 'pi_123', metadata: { reference: 'stripe-ref-123' } } as never,
        req
      )
    ).rejects.toThrow('claim assign failed');
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('skips cash-advance repayment when crediting a claim-order top-up', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      makeTransaction({ status: 'authorized', payment_entity: 'claim_order' })
    );
    databaseService.getTransactionById.mockResolvedValue(
      makeTransaction({ status: 'success', payment_entity: 'claim_order' })
    );
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
    });

    await processor.onPaymentIntentSucceeded(
      {
        id: 'pi_123',
        metadata: { reference: 'stripe-ref-123' },
      } as never,
      req
    );

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 125,
      memo: 'Stripe payment deposit - stripe-ref-123',
      referenceId: 'tx-123',
      skipCashAdvanceRepayment: true,
    });
  });

  it('credits capture_pending webhooks through the idempotent deposit path', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      makeTransaction({ status: 'capture_pending' })
    );
    databaseService.getTransactionById.mockResolvedValue(
      makeTransaction({ status: 'success' })
    );
    accountsService.registerDepositIfNotExists.mockResolvedValue({
      success: true,
      alreadyExists: true,
    });

    await processor.onPaymentIntentSucceeded(
      {
        id: 'pi_123',
        metadata: { reference: 'stripe-ref-123' },
      } as never,
      req
    );

    expect(accountsService.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 125,
      memo: 'Stripe payment deposit - stripe-ref-123',
      referenceId: 'tx-123',
      skipCashAdvanceRepayment: true,
    });
    expect(callbackHandler.onPaymentSuccess).toHaveBeenCalled();
  });

  it('skips order failure side effects when cancellation is already recorded', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      makeTransaction({ status: 'authorized' })
    );
    hasuraSystemService.executeQuery.mockResolvedValue({
      orders: [{ current_status: 'cancelled', payment_status: 'cancelled' }],
    });

    await processor.onPaymentIntentCanceled(
      {
        id: 'pi_123',
        metadata: { reference: 'stripe-ref-123' },
        cancellation_reason: 'automatic',
      } as never,
      req
    );

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'expired',
      stripe_payment_intent_id: 'pi_123',
      error_message: 'Payment authorization expired',
    });
    expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('query OrderCancelState'),
      { orderNumber: 'ORDER-1001' }
    );
    expect(callbackHandler.onPaymentFailure).not.toHaveBeenCalled();
  });

  describe('order tax snapshot lifecycle', () => {
    it('finalizes the snapshot when the PI-succeeded webhook finds our own capture already success', async () => {
      databaseService.getTransactionByReference.mockResolvedValue(
        makeTransaction({ status: 'success' })
      );
      const pi = { id: 'pi_123', metadata: { reference: 'stripe-ref-123' } };

      await processor.onPaymentIntentSucceeded(pi as never, req);

      expect(orderTaxLifecycle.finalizeAfterCapture).toHaveBeenCalledWith({
        orderNumber: 'ORDER-1001',
        paymentIntent: pi,
      });
      expect(databaseService.updateTransaction).not.toHaveBeenCalled();
      expect(accountsService.registerDepositIfNotExists).not.toHaveBeenCalled();
    });

    it('a deferred finalize on the already-success path warns for the reconciler and never throws', async () => {
      databaseService.getTransactionByReference.mockResolvedValue(
        makeTransaction({ status: 'success' })
      );
      orderTaxLifecycle.finalizeAfterCapture.mockResolvedValue('deferred');
      const warn = jest.spyOn((processor as any).logger, 'warn').mockImplementation();
      await expect(
        processor.onPaymentIntentSucceeded(
          { id: 'pi_123', metadata: { reference: 'stripe-ref-123' } } as never,
          req
        )
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('order_tax_finalize_needs_reconcile order=ORDER-1001')
      );
    });

    describe('charge.refunded with a tax-inclusive card refund', () => {
      const charge = {
        payment_intent: 'pi_123',
        amount_refunded: 11300, // ledger 100.00 + 13.00 tax
        refunded: true,
        refunds: { data: [{ id: 're_9', metadata: {} }] },
      } as never;

      it('reverses only the LEDGER part from the wallet (the wallet never held the tax)', async () => {
        databaseService.getTransactionByPaymentIntentId.mockResolvedValue(
          makeTransaction({ status: 'success', amount: 100 })
        );
        (databaseService as any).getRefundFullByStripeId = jest.fn().mockResolvedValue({
          id: 'rf-1',
          status: 'pending',
          amount: 100,
          refund_type: 'cancellation',
          refund_payment_id: null,
        });
        const reverse = jest.fn().mockResolvedValue(undefined);
        (processor as any).reverseWalletForRefund = reverse;
        await processor.onChargeRefunded(charge);
        expect(reverse).toHaveBeenCalledWith(expect.anything(), 100);
      });

      it('never reverses more than the ledger amount even without a refund record', async () => {
        databaseService.getTransactionByPaymentIntentId.mockResolvedValue(
          makeTransaction({ status: 'success', amount: 100 })
        );
        const reverse = jest.fn().mockResolvedValue(undefined);
        (processor as any).reverseWalletForRefund = reverse;
        await processor.onChargeRefunded({ ...(charge as object), refunds: { data: [] } } as never);
        expect(reverse).toHaveBeenCalledWith(expect.anything(), 100);
      });
    });

    it('does not finalize an order snapshot for non-order entities', async () => {
      databaseService.getTransactionByReference.mockResolvedValue(
        makeTransaction({ status: 'success', payment_entity: 'claim_order' })
      );
      await processor.onPaymentIntentSucceeded(
        { id: 'pi_123', metadata: { reference: 'stripe-ref-123' } } as never,
        req
      );
      expect(orderTaxLifecycle.finalizeAfterCapture).not.toHaveBeenCalled();
    });

    it('voids the estimate when the authorization is cancelled/expired', async () => {
      databaseService.getTransactionByReference.mockResolvedValue(
        makeTransaction({ status: 'authorized' })
      );
      hasuraSystemService.executeQuery.mockResolvedValue({
        orders: [{ current_status: 'cancelled', payment_status: 'cancelled' }],
      });
      await processor.onPaymentIntentCanceled(
        {
          id: 'pi_123',
          metadata: { reference: 'stripe-ref-123' },
          cancellation_reason: 'automatic',
        } as never,
        req
      );
      expect(orderTaxLifecycle.voidForOrder).toHaveBeenCalledWith('ORDER-1001');
    });

    describe('refund.updated', () => {
      const refund = (over: Record<string, unknown> = {}) =>
        ({
          id: 're_9',
          status: 'succeeded',
          amount: 5650,
          payment_intent: 'pi_123',
          metadata: { orderNumber: 'ORDER-1001', refundType: 'cancellation' },
          ...over,
        }) as never;

      beforeEach(() => {
        (databaseService as any).getRefundFullByStripeId = jest.fn().mockResolvedValue({
          id: 'rf-1',
          status: 'pending',
          amount: 56.5,
          refund_type: 'cancellation',
          refund_payment_id: null,
        });
        (databaseService as any).updateRefundByStripeId = jest.fn();
        databaseService.getTransactionByPaymentIntentId.mockResolvedValue(null);
      });

      it('reverses tax once a pending refund succeeds', async () => {
        await processor.onRefundUpdated(refund());
        expect(orderTaxLifecycle.reverseForRefund).toHaveBeenCalledWith({
          orderNumber: 'ORDER-1001',
          stripeRefundId: 're_9',
          refundAmountMinor: 5650,
        });
      });

      it('does not reverse a failed refund', async () => {
        await processor.onRefundUpdated(refund({ status: 'failed' }));
        expect(orderTaxLifecycle.reverseForRefund).not.toHaveBeenCalled();
      });

      it('skips reversal when the refund carries no order number', async () => {
        await processor.onRefundUpdated(refund({ metadata: {} }));
        expect(orderTaxLifecycle.reverseForRefund).not.toHaveBeenCalled();
      });

      it('a reversal failure never blocks the refund bookkeeping', async () => {
        orderTaxLifecycle.reverseForRefund.mockRejectedValue(new Error('stripe tax'));
        await expect(processor.onRefundUpdated(refund())).resolves.toBeUndefined();
        expect((databaseService as any).updateRefundByStripeId).toHaveBeenCalledWith(
          're_9',
          expect.objectContaining({ status: 'succeeded' })
        );
      });
    });
  });
});
