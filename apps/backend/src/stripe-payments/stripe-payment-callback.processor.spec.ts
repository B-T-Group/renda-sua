import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';

jest.mock(
  '../mobile-payments/payment-callback/payment-callback-registry.service',
  () => ({ PaymentCallbackRegistryService: class PaymentCallbackRegistryService {} })
);

describe('StripePaymentCallbackProcessor wallet credits', () => {
  it('leaves manual rental capture settlement to the return flow', async () => {
    const processor: any = Object.create(
      StripePaymentCallbackProcessor.prototype
    );
    processor.accountsService = {
      registerTransactionIfMissing: jest.fn(),
    };

    await processor.creditWalletIfNeeded({
      id: 'stripe-tx-1',
      account_id: 'account-1',
      amount: 480,
      transaction_type: 'PAYMENT',
      payment_entity: 'rental_booking',
      capture_method: 'manual',
    });

    expect(
      processor.accountsService.registerTransactionIfMissing
    ).not.toHaveBeenCalled();
  });
});
