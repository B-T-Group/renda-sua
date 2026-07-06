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
      'capture_order-id-123'
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

    await expect(
      service.cancelOrderPaymentIntent({ orderNumber: 'ORDER-1001' })
    ).resolves.toEqual({
      success: false,
      message: 'Payment already captured; use refund',
    });

    expect(stripeService.cancelPaymentIntent).not.toHaveBeenCalled();
    expect(databaseService.updateTransaction).not.toHaveBeenCalled();
  });
});
