import type { Request } from 'express';
import type Stripe from 'stripe';
import type { AccountsService } from '../accounts/accounts.service';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';
import type {
  StripePaymentsDatabaseService,
  StripePaymentTransaction,
} from './stripe-payments-database.service';

type DatabaseMock = jest.Mocked<
  Pick<
    StripePaymentsDatabaseService,
    | 'getTransactionByReference'
    | 'getTransactionBySessionId'
    | 'getTransactionByPaymentIntentId'
    | 'updateTransaction'
  >
>;

describe('StripePaymentCallbackProcessor', () => {
  let service: StripePaymentCallbackProcessor;
  let databaseService: DatabaseMock;
  let accountsService: jest.Mocked<Pick<AccountsService, 'registerTransaction'>>;
  let callbackRegistry: jest.Mocked<
    Pick<PaymentCallbackRegistryService, 'getHandlers'>
  >;
  let handler: jest.Mocked<PaymentCallbackHandler>;

  const request = {} as Request;

  const buildTransaction = (
    overrides: Partial<StripePaymentTransaction> = {}
  ): StripePaymentTransaction => ({
    id: 'tx-123',
    reference: 'ref-123',
    amount: 100,
    currency: 'USD',
    description: 'Order payment',
    status: 'pending',
    transaction_type: 'PAYMENT',
    stripe_payment_intent_id: 'pi-123',
    account_id: 'account-123',
    payment_entity: 'order',
    entity_id: 'order-123',
    customer_email: 'client@example.com',
    created_at: '2026-06-27T10:00:00.000Z',
    updated_at: '2026-06-27T10:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    databaseService = {
      getTransactionByReference: jest.fn(),
      getTransactionBySessionId: jest.fn(),
      getTransactionByPaymentIntentId: jest.fn(),
      updateTransaction: jest.fn(),
    };
    accountsService = {
      registerTransaction: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as jest.Mocked<Pick<AccountsService, 'registerTransaction'>>;
    callbackRegistry = { getHandlers: jest.fn() };
    handler = {
      supportsPaymentEntity: jest.fn((entity) => entity === 'order'),
      finalizeCashReconciliationAfterPayment: jest.fn(),
      onPaymentSuccess: jest.fn(),
      onPaymentFailure: jest.fn(),
    };

    callbackRegistry.getHandlers.mockResolvedValue([handler]);
    databaseService.updateTransaction.mockResolvedValue(buildTransaction());
    service = new StripePaymentCallbackProcessor(
      databaseService as unknown as StripePaymentsDatabaseService,
      accountsService as unknown as AccountsService,
      callbackRegistry as unknown as PaymentCallbackRegistryService
    );
  });

  it('finalizes direct PaymentIntent payments once', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      buildTransaction()
    );

    await service.onPaymentIntentSucceeded(
      { id: 'pi-123', metadata: { reference: 'ref-123' } } as Stripe.PaymentIntent,
      request
    );

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'success',
      stripe_payment_intent_id: 'pi-123',
    });
    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 100,
      transactionType: 'deposit',
      memo: 'Stripe payment deposit - ref-123',
      referenceId: 'tx-123',
    });
    expect(handler.onPaymentSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stripe',
        payment_method: 'card',
        payment_entity: 'order',
        entity_id: 'order-123',
        transaction_id: 'pi-123',
      })
    );
  });

  it('skips PaymentIntent success for hosted Checkout transactions', async () => {
    databaseService.getTransactionByReference.mockResolvedValue(
      buildTransaction({ stripe_session_id: 'cs-123' })
    );

    await service.onPaymentIntentSucceeded(
      { id: 'pi-123', metadata: { reference: 'ref-123' } } as Stripe.PaymentIntent,
      request
    );

    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(callbackRegistry.getHandlers).not.toHaveBeenCalled();
  });

  it('caps refund wallet reversals to the original transaction amount', async () => {
    databaseService.getTransactionByPaymentIntentId.mockResolvedValue(
      buildTransaction({ amount: 100 })
    );

    await service.onChargeRefunded({
      payment_intent: 'pi-123',
      amount_refunded: 15_000,
    } as Stripe.Charge);

    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 100,
      transactionType: 'withdrawal',
      memo: 'Stripe refund reversal - ref-123',
      referenceId: 'tx-123',
    });
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'refunded',
      error_message: 'Refunded 100 USD via Stripe',
    });
  });
});
