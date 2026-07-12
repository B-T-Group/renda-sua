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
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);

    await service.processTokenPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 15,
      currency: 'CAD',
    });

    expect(grantPackTokens).toHaveBeenCalledWith('business-1', 1000, 'pay-1');
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
