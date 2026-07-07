import type { Request } from 'express';
import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';

describe('StripePaymentCallbackProcessor', () => {
  let processor: StripePaymentCallbackProcessor;
  let databaseService: {
    getTransactionByReference: jest.Mock;
    getTransactionByPaymentIntentId: jest.Mock;
    updateTransaction: jest.Mock;
  };
  let accountsService: {
    hasTransactionForReference: jest.Mock;
    registerTransaction: jest.Mock;
  };
  let handler: {
    supportsPaymentEntity: jest.Mock;
    onPaymentSuccess: jest.Mock;
  };

  const tx = {
    id: 'stripe-tx-123',
    reference: 'checkout-ref',
    amount: 120,
    currency: 'CAD',
    description: 'Order payment',
    status: 'success',
    transaction_type: 'PAYMENT',
    capture_method: 'manual',
    stripe_payment_intent_id: 'pi_123',
    account_id: 'account-123',
    payment_entity: 'order',
    entity_id: 'ORD-123',
    customer_email: 'client@example.com',
    created_at: '2026-07-07T10:00:00.000Z',
    updated_at: '2026-07-07T10:01:00.000Z',
  };

  beforeEach(() => {
    databaseService = {
      getTransactionByReference: jest.fn().mockResolvedValue(tx),
      getTransactionByPaymentIntentId: jest.fn(),
      updateTransaction: jest.fn(),
    };
    accountsService = {
      hasTransactionForReference: jest.fn(),
      registerTransaction: jest.fn(),
    };
    handler = {
      supportsPaymentEntity: jest.fn().mockReturnValue(true),
      onPaymentSuccess: jest.fn().mockResolvedValue(undefined),
    };
    processor = new StripePaymentCallbackProcessor(
      databaseService as any,
      accountsService as any,
      { getHandlers: jest.fn().mockResolvedValue([handler]) } as any,
      {} as any,
      {} as any
    );
  });

  it('retries side effects for already-success manual capture webhooks', async () => {
    accountsService.hasTransactionForReference.mockResolvedValue(false);
    accountsService.registerTransaction.mockResolvedValue({ success: true });

    await processor.onPaymentIntentSucceeded(paymentIntent(), {} as Request);

    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 120,
      transactionType: 'deposit',
      memo: 'Stripe payment deposit - checkout-ref',
      referenceId: 'stripe-tx-123',
    });
    expect(handler.onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stripe-tx-123',
        status: 'success',
        payment_entity: 'order',
        entity_id: 'ORD-123',
      })
    );
  });

  it('does not double-credit when retrying already-credited captures', async () => {
    accountsService.hasTransactionForReference.mockResolvedValue(true);

    await processor.onPaymentIntentSucceeded(paymentIntent(), {} as Request);

    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(handler.onPaymentSuccess).toHaveBeenCalledTimes(1);
  });
});

function paymentIntent() {
  return {
    id: 'pi_123',
    status: 'succeeded',
    metadata: { reference: 'checkout-ref' },
  } as any;
}
