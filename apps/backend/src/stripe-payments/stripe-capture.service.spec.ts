import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../accounts/accounts.service';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripeCaptureService } from './stripe-capture.service';
import { StripeService } from './stripe.service';
import type { StripePaymentTransaction } from './stripe-payments-database.service';

describe('StripeCaptureService', () => {
  const stripeService = {
    capturePaymentIntent: jest.fn(),
    cancelPaymentIntent: jest.fn(),
  };
  const databaseService = {
    getTransactionByEntityId: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const accountsService = {
    registerTransaction: jest.fn(),
  };

  let service: StripeCaptureService;

  const transaction = (
    overrides: Partial<StripePaymentTransaction> = {}
  ): StripePaymentTransaction => ({
    id: 'tx-123',
    reference: 'ORDER-123',
    amount: 42.5,
    currency: 'CAD',
    status: 'authorized',
    transaction_type: 'PAYMENT',
    capture_method: 'manual',
    stripe_payment_intent_id: 'pi-123',
    account_id: 'account-123',
    payment_entity: 'order',
    entity_id: 'ORDER-123',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue({
      manualCaptureEnabled: true,
      manualCaptureCountries: ['CA'],
    });
    service = new StripeCaptureService(
      stripeService as unknown as StripeService,
      databaseService as unknown as StripePaymentsDatabaseService,
      configService as unknown as ConfigService,
      accountsService as unknown as AccountsService
    );
  });

  it('enables manual capture only for configured seller countries', () => {
    expect(service.resolveCaptureMethodForOrderEntity(' ca ')).toBe('manual');
    expect(service.resolveCaptureMethodForOrderEntity('US')).toBe('automatic');
    expect(service.resolveCaptureMethodForOrderEntity()).toBe('automatic');

    configService.get.mockReturnValue({
      manualCaptureEnabled: false,
      manualCaptureCountries: ['CA'],
    });
    expect(service.resolveCaptureMethodForOrderEntity('CA')).toBe('automatic');
  });

  it('captures authorized manual payment intents and marks transactions successful', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(transaction());
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-uuid',
        orderNumber: 'ORDER-123',
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi-123',
      'capture_order-uuid'
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(1, 'tx-123', {
      status: 'capture_pending',
    });
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      expect.objectContaining({ status: 'success', captured_at: expect.any(String) })
    );
  });

  it('restores authorized status when Stripe capture fails', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(transaction());
    stripeService.capturePaymentIntent.mockRejectedValue(new Error('card declined'));

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-uuid',
        orderNumber: 'ORDER-123',
      })
    ).resolves.toEqual({ success: false, message: 'card declined' });

    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(1, 'tx-123', {
      status: 'capture_pending',
    });
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(2, 'tx-123', {
      status: 'authorized',
      error_message: 'card declined',
    });
  });

  it('does not call Stripe when capture is automatic or transaction is invalid', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      transaction({ capture_method: 'automatic' })
    );

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-uuid',
        orderNumber: 'ORDER-123',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Automatic capture order',
      captured: true,
    });

    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('cancels uncaptured payment intents and records cancellation', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(transaction());
    stripeService.cancelPaymentIntent.mockResolvedValue({ status: 'canceled' });

    await expect(
      service.cancelOrderPaymentIntent({
        orderNumber: 'ORDER-123',
        orderId: 'order-uuid',
      })
    ).resolves.toEqual({ success: true });

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'cancelled',
      error_message: 'Payment authorization cancelled',
    });
    expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
      'pi-123',
      'cancel_order-uuid'
    );
  });

  it('credits the wallet for captured order payments only', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(transaction());
    accountsService.registerTransaction.mockResolvedValue({ success: true });

    await expect(
      service.creditWalletForCapturedOrder('ORDER-123')
    ).resolves.toBe('account-123');

    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: 'account-123',
      amount: 42.5,
      transactionType: 'deposit',
      memo: 'Stripe payment deposit - ORDER-123',
      referenceId: 'tx-123',
    });
  });
});
