import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';

describe('StripePaymentCallbackProcessor', () => {
  const databaseService = {
    getTransactionByReference: jest.fn(),
    getTransactionByPaymentIntentId: jest.fn(),
    updateTransaction: jest.fn(),
    hasStripePaymentDeposit: jest.fn(),
  };
  const accountsService = {
    registerTransaction: jest.fn(),
  };
  const handler = {
    supportsPaymentEntity: jest.fn((entity?: string) => entity === 'order'),
    onPaymentSuccess: jest.fn(),
  };
  const paymentCallbackRegistry = {
    getHandlers: jest.fn().mockReturnValue([handler]),
  };
  const stripeService = {
    retrievePaymentIntent: jest.fn(),
  };
  const hasuraSystemService = {
    executeQuery: jest.fn(),
  };

  const tx = {
    id: '11111111-1111-1111-1111-111111111111',
    reference: 'ref-123',
    amount: 42,
    currency: 'CAD',
    status: 'success',
    transaction_type: 'PAYMENT',
    capture_method: 'manual',
    stripe_payment_intent_id: 'pi_123',
    account_id: '22222222-2222-2222-2222-222222222222',
    payment_entity: 'order',
    entity_id: 'ORD-123',
    customer_email: 'client@example.com',
    created_at: '2026-07-06T00:00:00.000Z',
    updated_at: '2026-07-06T00:00:00.000Z',
  } as const;

  let processor: StripePaymentCallbackProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentCallbackRegistry.getHandlers.mockReturnValue([handler]);
    processor = new StripePaymentCallbackProcessor(
      databaseService as never,
      accountsService as never,
      paymentCallbackRegistry as never,
      stripeService as never,
      hasuraSystemService as never
    );
  });

  it('runs success side effects for already-success manual capture events', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(tx);
    databaseService.updateTransaction.mockResolvedValue(tx);
    databaseService.hasStripePaymentDeposit.mockResolvedValue(true);

    await processor.onPaymentIntentSucceeded(
      {
        id: 'pi_123',
        status: 'succeeded',
        metadata: { reference: 'ref-123' },
      } as never,
      {} as never
    );

    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(handler.onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: tx.id,
        status: 'success',
        payment_entity: 'order',
        entity_id: 'ORD-123',
      })
    );
  });
});
