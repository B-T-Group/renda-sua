import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService', () => {
  const stripeService = {
    capturePaymentIntent: jest.fn(),
    cancelPaymentIntent: jest.fn(),
  };
  const databaseService = {
    getTransactionByEntityId: jest.fn(),
    updateTransaction: jest.fn(),
    hasStripePaymentDeposit: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue({
      manualCaptureEnabled: true,
      manualCaptureCountries: ['CA', 'US'],
    }),
  };
  const accountsService = {
    registerTransaction: jest.fn(),
  };

  const baseTx = {
    id: '11111111-1111-1111-1111-111111111111',
    reference: 'ref-123',
    amount: 42,
    currency: 'CAD',
    status: 'authorized',
    transaction_type: 'PAYMENT',
    capture_method: 'manual',
    stripe_payment_intent_id: 'pi_123',
    account_id: '22222222-2222-2222-2222-222222222222',
    created_at: '2026-07-06T00:00:00.000Z',
    updated_at: '2026-07-06T00:00:00.000Z',
  } as const;

  let service: StripeCaptureService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripeCaptureService(
      stripeService as never,
      databaseService as never,
      configService as never,
      accountsService as never
    );
  });

  it('does not finalize again when a manual transaction is already captured', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue({
      ...baseTx,
      status: 'success',
    });

    await expect(
      service.captureOrderPaymentIntent({
        orderId: 'order-123',
        orderNumber: 'ORD-123',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Already captured',
      captured: false,
    });

    expect(stripeService.capturePaymentIntent).not.toHaveBeenCalled();
  });

  it('treats an existing Stripe wallet deposit as already credited', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue(baseTx);
    databaseService.hasStripePaymentDeposit.mockResolvedValue(true);

    await expect(
      service.creditWalletForCapturedOrder('ORD-123')
    ).resolves.toBe(baseTx.account_id);

    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });
});
