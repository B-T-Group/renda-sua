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
    updateTransaction: jest.Mock;
  };
  let accountsService: {
    registerTransaction: jest.Mock;
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
  };
  let hasuraSystemService: {
    executeQuery: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    databaseService = {
      getTransactionByReference: jest.fn(),
      getTransactionBySessionId: jest.fn(),
      getTransactionByPaymentIntentId: jest.fn(),
      updateTransaction: jest.fn(),
    };
    accountsService = { registerTransaction: jest.fn() };
    callbackHandler = {
      supportsPaymentEntity: jest.fn((entity) => entity === 'order'),
      finalizeCashReconciliationAfterPayment: jest.fn(),
      onPaymentSuccess: jest.fn(),
      onPaymentAuthorized: jest.fn(),
      onPaymentFailure: jest.fn(),
    };
    paymentCallbackRegistry = {
      getHandlers: jest.fn().mockResolvedValue([callbackHandler]),
    };
    stripeService = { retrievePaymentIntent: jest.fn() };
    hasuraSystemService = { executeQuery: jest.fn() };
    processor = new StripePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      stripeService as never,
      hasuraSystemService as never
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
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(callbackHandler.onPaymentSuccess).not.toHaveBeenCalled();
  });

  it('finalizes authorized manual payments when the PaymentIntent succeeds', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      makeTransaction({ status: 'authorized' })
    );
    accountsService.registerTransaction.mockResolvedValue({ success: true });

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
    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 125,
      transactionType: 'deposit',
      memo: 'Stripe payment deposit - stripe-ref-123',
      referenceId: 'tx-123',
    });
    expect(callbackHandler.onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx-123', reference: 'stripe-ref-123' })
    );
    expect(callbackHandler.onPaymentFailure).not.toHaveBeenCalled();
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
});
