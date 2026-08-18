import type { StripePaymentTransaction } from './stripe-payments-database.service';
import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService', () => {
  const now = new Date('2026-07-06T10:00:00.000Z');
  let config: {
    manualCaptureEnabled: boolean;
    manualCaptureCountries?: string[];
  };
  let service: StripeCaptureService;
  let stripeService: {
    capturePaymentIntent: jest.Mock;
    cancelPaymentIntent: jest.Mock;
    retrievePaymentIntent: jest.Mock;
    expireCheckoutSession: jest.Mock;
  };
  let databaseService: {
    getTransactionByEntityId: jest.Mock;
    updateTransaction: jest.Mock;
  };
  let accountsService: {
    registerTransaction: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    config = { manualCaptureEnabled: true, manualCaptureCountries: ['CA'] };
    stripeService = {
      capturePaymentIntent: jest.fn(),
      cancelPaymentIntent: jest.fn(),
      retrievePaymentIntent: jest.fn(),
      expireCheckoutSession: jest.fn(),
    };
    databaseService = {
      getTransactionByEntityId: jest.fn(),
      updateTransaction: jest.fn(),
    };
    accountsService = {
      registerTransaction: jest.fn(),
    };
    service = new StripeCaptureService(
      stripeService as never,
      databaseService as never,
      { get: jest.fn(() => config) } as never,
      accountsService as never
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
      reference: 'ORDER-1001',
      amount: 125,
      currency: 'CAD',
      status: 'authorized',
      transaction_type: 'PAYMENT',
      capture_method: 'manual',
      stripe_payment_intent_id: 'pi_123',
      account_id: 'account-123',
      payment_entity: 'order',
      entity_id: 'ORDER-1001',
      created_at: '2026-07-06T09:00:00.000Z',
      updated_at: '2026-07-06T09:00:00.000Z',
      ...overrides,
    };
  }

  it('resolves manual capture only for configured countries', () => {
    expect(service.resolveCaptureMethodForOrderEntity(' ca ')).toBe('manual');
    expect(service.resolveCaptureMethodForOrderEntity('CM')).toBe('automatic');

    config.manualCaptureCountries = [];
    expect(service.resolveCaptureMethodForOrderEntity('CM')).toBe('manual');

    config.manualCaptureEnabled = false;
    expect(service.resolveCaptureMethodForOrderEntity('CA')).toBe('automatic');
  });

  it('always uses manual capture for pickup and shipping', () => {
    config.manualCaptureEnabled = false;
    expect(service.resolveCaptureMethodForOrderEntity('CM', 'pickup')).toBe(
      'manual'
    );
    expect(service.resolveCaptureMethodForOrderEntity('CM', 'shipping')).toBe(
      'manual'
    );
  });

  it('captures an authorized manual transaction and records the capture time', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'capture_order-id-123',
      undefined
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'success', captured_at: now.toISOString() }
    );
  });

  it('persists partial captureAmount so wallet credit matches Stripe charge', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.capturePaymentIntent.mockResolvedValue({ status: 'succeeded' });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({ success: true, captured: true });

    expect(stripeService.capturePaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'capture_order-id-123',
      { amount: 100, currency: 'CAD' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending', amount: 100 }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'success', captured_at: now.toISOString(), amount: 100 }
    );
  });

  it('persists partial amount when syncing an already captured PaymentIntent', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
      amount_received: 10000,
    });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({
      success: true,
      message: 'Already captured on Stripe',
      captured: true,
    });

    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'success',
      captured_at: now.toISOString(),
      amount: 100,
    });
  });

  it('does not overwrite amount when Stripe already captured the full charge', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
      amount_received: 12500,
    });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
        captureAmount: 100,
      })
    ).resolves.toEqual({
      success: true,
      message: 'Already captured on Stripe',
      captured: true,
    });

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'success',
      captured_at: now.toISOString(),
    });
  });

  it('credits wallet using the persisted (possibly partial) transaction amount', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'success', amount: 100 })
    );
    accountsService.registerTransaction.mockResolvedValue({ success: true });

    await expect(
      service.creditWalletForCapturedOrder('ORDER-1001')
    ).resolves.toBe('account-123');

    expect(accountsService.registerTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-123',
        amount: 100,
        transactionType: 'deposit',
      })
    );
  });

  it('restores authorization status when Stripe capture fails', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(makeTransaction());
    stripeService.capturePaymentIntent.mockRejectedValue(new Error('Stripe down'));

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({ success: false, message: 'Stripe down' });

    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-123',
      { status: 'capture_pending' }
    );
    expect(databaseService.updateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-123',
      { status: 'authorized', error_message: 'Stripe down' }
    );
  });

  it('does not call Stripe capture for automatic capture transactions', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ capture_method: 'automatic', status: 'pending' })
    );

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Automatic capture order',
      captured: true,
    });

    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('cancels eligible authorizations and records cancellation before Stripe call', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'capture_pending' })
    );
    stripeService.cancelPaymentIntent.mockResolvedValue({ id: 'pi_123' });

    await expect(
      service.cancelOrderPaymentIntent({
        orderId: 'order-id-123',
        orderNumber: 'ORDER-1001',
      })
    ).resolves.toEqual({ success: true });

    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'cancelled',
      error_message: 'Payment authorization cancelled',
    });
    expect(stripeService.cancelPaymentIntent).toHaveBeenCalledWith(
      'pi_123',
      'cancel_order-id-123'
    );
  });

  it('blocks cancellation after capture so callers use refunds instead', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({ status: 'success' })
    );
    stripeService.retrievePaymentIntent.mockResolvedValue({
      status: 'succeeded',
    });

    await expect(
      service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
    ).resolves.toEqual({
      success: false,
      message: 'Payment already captured; use refund',
    });

    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('expires an open checkout session when the PaymentIntent does not exist yet', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(
      makeTransaction({
        status: 'pending',
        stripe_payment_intent_id: undefined,
        stripe_session_id: 'cs_123',
      })
    );
    stripeService.expireCheckoutSession.mockResolvedValue({ id: 'cs_123' });

    await expect(
      service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
    ).resolves.toEqual({ success: true });

    expect(stripeService.expireCheckoutSession).toHaveBeenCalledWith('cs_123');
    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('tx-123', {
      status: 'cancelled',
      error_message: 'Checkout session expired on order cancellation',
    });
  });
});
