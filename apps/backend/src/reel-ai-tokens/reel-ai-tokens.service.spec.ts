import { ReelAiTokensService } from './reel-ai-tokens.service';

describe('ReelAiTokensService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUserService = {
    getUser: jest.fn(),
  };
  const paymentRoutingService = {
    resolveRailForBusiness: jest.fn(),
    getBusinessCountryCode: jest.fn(),
  };
  const stripeCheckoutService = {
    createCheckout: jest.fn(),
    createPaymentIntent: jest.fn(),
  };
  const mobilePaymentsService = {
    getProvider: jest.fn(),
    initiatePayment: jest.fn(),
  };
  const mobilePaymentsDatabaseService = {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
  };

  let service: ReelAiTokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReelAiTokensService(
      hasuraSystemService as never,
      hasuraUserService as never,
      paymentRoutingService as never,
      stripeCheckoutService as never,
      mobilePaymentsService as never,
      mobilePaymentsDatabaseService as never
    );
  });

  it('reserves one token atomically when balance is sufficient', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses: { returning: [{ ai_reel_tokens: 2 }] },
    });

    await expect(service.tryReserveTokens('business-1', 1)).resolves.toBe(2);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ReserveAiReelTokens'),
      { id: 'business-1', cost: 1, delta: -1 }
    );
  });

  it('returns null when reserve finds insufficient tokens', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses: { returning: [] },
    });

    await expect(service.tryReserveTokens('business-1')).resolves.toBeNull();
  });

  it('refunds tokens after a failed generation', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses_by_pk: { ai_reel_tokens: 3 },
    });

    await service.refundTokens('business-1', 1);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('RefundAiReelTokens'),
      { id: 'business-1', amount: 1 }
    );
  });

  it('grants the pack matching a successful reel AI token payment', async () => {
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'recordUsage').mockResolvedValue(true);

    await service.processPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 1500,
      currency: 'XAF',
    });

    expect(grantPackTokens).toHaveBeenCalledWith('business-1', 1, 'pay-1');
  });

  it('skips grant when payment reference was already claimed', async () => {
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);
    jest.spyOn(service, 'recordUsage').mockResolvedValue(false);

    await service.processPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 1500,
      currency: 'XAF',
    });

    expect(grantPackTokens).not.toHaveBeenCalled();
  });

  it('releases the purchase claim when grant fails so retries can succeed', async () => {
    jest.spyOn(service, 'recordUsage').mockResolvedValue(true);
    jest
      .spyOn(service, 'grantPackTokens')
      .mockRejectedValue(new Error('hasura down'));
    hasuraSystemService.executeMutation.mockResolvedValue({
      delete_business_ai_reel_token_usage: { affected_rows: 1 },
    });

    await expect(
      service.processPaymentSuccess({
        entity_id: 'business-1',
        reference: 'pay-1',
        amount: 1500,
        currency: 'XAF',
      })
    ).rejects.toThrow('hasura down');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('DeleteAiReelTokenPurchaseClaim'),
      { ref: 'pay-1' }
    );
  });

  it('requires reel AI token payments to include a business id', async () => {
    await expect(
      service.processPaymentSuccess({
        entity_id: null,
        amount: 1500,
        currency: 'XAF',
      })
    ).rejects.toThrow('Reel AI token payment missing business id');
  });

  it('rejects payments that cannot be mapped to a reel AI pack', async () => {
    const grantPackTokens = jest.spyOn(service, 'grantPackTokens');

    await expect(
      service.processPaymentSuccess({
        entity_id: 'business-1',
        amount: 999,
        currency: 'CAD',
        description: 'Custom payment',
      })
    ).rejects.toThrow('No reel AI token pack for 999 CAD');
    expect(grantPackTokens).not.toHaveBeenCalled();
  });

  it('does not grant a pack from description when the paid amount does not match', async () => {
    const grantPackTokens = jest.spyOn(service, 'grantPackTokens');

    await expect(
      service.processPaymentSuccess({
        entity_id: 'business-1',
        reference: 'cheap-pay',
        amount: 1,
        currency: 'CAD',
        description: 'AI reel tokens pack 15',
      })
    ).rejects.toThrow('No reel AI token pack for 1 CAD');
    expect(grantPackTokens).not.toHaveBeenCalled();
  });

  it('stores the provider transaction id so MoMo callbacks can credit tokens', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      phone_number: '+237600000000',
      business: { id: 'business-1' },
    });
    paymentRoutingService.getBusinessCountryCode.mockResolvedValue('CM');
    hasuraSystemService.executeQuery.mockResolvedValue({
      supported_country_states: [{ currency_code: 'XAF' }],
    });
    paymentRoutingService.resolveRailForBusiness.mockResolvedValue(
      'mobile_money'
    );
    mobilePaymentsService.getProvider.mockReturnValue('mypvit');
    mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
      id: 'mp-tx-1',
    });
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: true,
      transactionId: 'provider-tx-9',
    });

    await service.initiatePackPurchase({
      packId: 'reel_ai_pack_1',
      phoneNumber: '+237600000000',
    });

    expect(mobilePaymentsDatabaseService.updateTransaction).toHaveBeenCalledWith(
      'mp-tx-1',
      { transaction_id: 'provider-tx-9' }
    );
  });
});
