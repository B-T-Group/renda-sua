import { HttpException, HttpStatus } from '@nestjs/common';
import { BusinessTokensService } from './business-tokens.service';

describe('BusinessTokensService', () => {
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

  let service: BusinessTokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessTokensService(
      hasuraSystemService as never,
      hasuraUserService as never,
      paymentRoutingService as never,
      stripeCheckoutService as never,
      mobilePaymentsService as never,
      mobilePaymentsDatabaseService as never
    );
  });

  it('debits one token and records usage after successful cleanup', async () => {
    hasuraSystemService.executeMutation.mockImplementation((query: string) => {
      if (query.includes('ConsumeAiToken')) {
        return Promise.resolve({ update_businesses: { returning: [{ ai_tokens: 4 }] } });
      }
      if (query.includes('InsertAiTokenUsage')) {
        return Promise.resolve({ insert_business_ai_token_usage_one: { id: 'usage-1' } });
      }
      return Promise.resolve({});
    });

    const result = await service.runCleanupWithToken(
      tokenParams(),
      async () => 'clean-image-url'
    );

    expect(result).toEqual({ result: 'clean-image-url', balanceAfter: 4 });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ConsumeAiToken'),
      { id: 'business-1', cost: 1, delta: -1 }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertAiTokenUsage'),
      {
        object: expect.objectContaining({
          business_id: 'business-1',
          tokens_consumed: 1,
          operation_type: 'image_cleanup',
          subject_type: 'business_image',
          created_by_user_id: 'user-1',
        }),
      }
    );
  });

  it('rejects cleanup when the conditional debit finds no available token', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses: { returning: [] },
    });
    const cleanupFn = jest.fn();

    try {
      await service.runCleanupWithToken(tokenParams(), cleanupFn);
      fail('Expected cleanup to require an AI token');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'No AI tokens remaining. Purchase more tokens to use image cleanup.',
        code: 'INSUFFICIENT_AI_TOKENS',
      });
    }
    expect(cleanupFn).not.toHaveBeenCalled();
  });

  it('refunds the token when cleanup fails after a successful debit', async () => {
    hasuraSystemService.executeMutation.mockImplementation((query: string) => {
      if (query.includes('ConsumeAiToken')) {
        return Promise.resolve({ update_businesses: { returning: [{ ai_tokens: 2 }] } });
      }
      if (query.includes('RefundAiToken')) {
        return Promise.resolve({ update_businesses_by_pk: { ai_tokens: 3 } });
      }
      return Promise.resolve({});
    });
    const cleanupError = new Error('cleanup failed');

    await expect(
      service.runCleanupWithToken(tokenParams(), async () => {
        throw cleanupError;
      })
    ).rejects.toThrow(cleanupError);

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('RefundAiToken'),
      { id: 'business-1', amount: 1 }
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
      expect.stringContaining('InsertAiTokenUsage'),
      expect.anything()
    );
  });

  it('grants the pack matching a successful token payment', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_ai_token_usage_one: { id: 'claim-1' },
    });
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);

    await service.processTokenPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 15,
      currency: 'CAD',
    });

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ClaimAiTokenPurchase'),
      {
        object: expect.objectContaining({
          business_id: 'business-1',
          tokens_consumed: 1000,
          operation_type: 'purchase',
          payment_reference: 'pay-1',
        }),
      }
    );
    expect(grantPackTokens).toHaveBeenCalledWith('business-1', 1000, 'pay-1');
  });

  it('skips grant when payment reference was already claimed', async () => {
    hasuraSystemService.executeMutation.mockRejectedValue(
      new Error('Uniqueness violation. duplicate key value')
    );
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);

    await service.processTokenPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 15,
      currency: 'CAD',
    });

    expect(grantPackTokens).not.toHaveBeenCalled();
  });

  it('releases the purchase claim when grant fails so retries can succeed', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_ai_token_usage_one: { id: 'claim-1' },
    });
    jest
      .spyOn(service, 'grantPackTokens')
      .mockRejectedValue(new Error('hasura down'));

    await expect(
      service.processTokenPaymentSuccess({
        entity_id: 'business-1',
        reference: 'pay-1',
        amount: 15,
        currency: 'CAD',
      })
    ).rejects.toThrow('hasura down');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('DeleteAiTokenPurchaseClaim'),
      { ref: 'pay-1' }
    );
  });

  it('requires token payments to include a business id', async () => {
    await expect(
      service.processTokenPaymentSuccess({
        entity_id: null,
        amount: 15,
        currency: 'CAD',
      })
    ).rejects.toThrow('Token payment missing business id');
  });

  it('rejects successful payments that cannot be mapped to a token pack', async () => {
    const grantPackTokens = jest.spyOn(service, 'grantPackTokens');

    await expect(
      service.processTokenPaymentSuccess({
        entity_id: 'business-1',
        amount: 999,
        currency: 'CAD',
        description: 'Custom payment',
      })
    ).rejects.toThrow('No token pack for 999 CAD');
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
      packId: 'pack_100',
      phoneNumber: '+237600000000',
    });

    expect(mobilePaymentsDatabaseService.updateTransaction).toHaveBeenCalledWith(
      'mp-tx-1',
      { transaction_id: 'provider-tx-9' }
    );
  });

  it('stores a unique long MoMo reference so repeat purchases can be credited', async () => {
    hasuraUserService.getUser.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      phone_number: '+237600000000',
      business: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
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
      packId: 'pack_100',
      phoneNumber: '+237600000000',
    });
    await service.initiatePackPurchase({
      packId: 'pack_100',
      phoneNumber: '+237600000000',
    });

    const firstRef =
      mobilePaymentsDatabaseService.createTransaction.mock.calls[0][0]
        .reference;
    const secondRef =
      mobilePaymentsDatabaseService.createTransaction.mock.calls[1][0]
        .reference;
    expect(firstRef).toMatch(/^TKN-/);
    expect(firstRef.length).toBeGreaterThan(15);
    expect(secondRef).not.toBe(firstRef);
    expect(mobilePaymentsService.initiatePayment.mock.calls[0][1]).toBe(
      firstRef
    );
    expect(mobilePaymentsService.initiatePayment.mock.calls[1][1]).toBe(
      secondRef
    );
  });
});

function tokenParams() {
  return {
    businessId: 'business-1',
    userId: 'user-1',
    subjectType: 'business_image' as const,
    subjectId: 'image-1',
    imageUrl: 'https://example.com/image.jpg',
  };
}
