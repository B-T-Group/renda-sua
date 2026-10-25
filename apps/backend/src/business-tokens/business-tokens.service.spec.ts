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
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 2 },
    });
    hasuraSystemService.executeMutation.mockImplementation((query: string) => {
      if (query.includes('DebitAiTokens')) {
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
      expect.stringContaining('DebitAiTokens'),
      {
        id: 'business-1',
        cost: 1,
        delta: -1,
        nongiftableDelta: -1,
        nongiftableMin: 1,
        nongiftableMax: 2147483647,
      }
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
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 0 },
    });
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
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 0 },
    });
    hasuraSystemService.executeMutation.mockImplementation((query: string) => {
      if (query.includes('DebitAiTokens')) {
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
      { id: 'business-1', amount: 1, nongiftable: 0 }
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
      expect.stringContaining('InsertAiTokenUsage'),
      expect.anything()
    );
  });

  it('restores nongiftable tokens when a free-allotment debit is refunded', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 20 },
    });
    hasuraSystemService.executeMutation.mockImplementation((query: string) => {
      if (query.includes('DebitAiTokens')) {
        return Promise.resolve({ update_businesses: { returning: [{ ai_tokens: 19 }] } });
      }
      if (query.includes('RefundAiToken')) {
        return Promise.resolve({ update_businesses_by_pk: { ai_tokens: 20 } });
      }
      return Promise.resolve({});
    });

    await expect(
      service.runCleanupWithToken(tokenParams(), async () => {
        throw new Error('cleanup failed');
      })
    ).rejects.toThrow('cleanup failed');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('RefundAiToken'),
      { id: 'business-1', amount: 1, nongiftable: 1 }
    );
  });

  it('reserves signup tokens by spending the nongiftable allotment first', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 20 },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses: { returning: [{ ai_tokens: 19 }] },
    });

    await expect(service.tryReserveTokens('business-1', 1)).resolves.toEqual({
      balanceAfter: 19,
      spentNongiftable: 1,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('DebitAiTokens'),
      {
        id: 'business-1',
        cost: 1,
        delta: -1,
        nongiftableDelta: -1,
        nongiftableMin: 1,
        nongiftableMax: 2147483647,
      }
    );
  });

  it('reserves purchased tokens without reducing a zero nongiftable allotment', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 0 },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses: { returning: [{ ai_tokens: 99 }] },
    });

    await expect(service.tryReserveTokens('business-1', 1)).resolves.toEqual({
      balanceAfter: 99,
      spentNongiftable: 0,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('DebitAiTokens'),
      {
        id: 'business-1',
        cost: 1,
        delta: -1,
        nongiftableDelta: 0,
        nongiftableMin: 0,
        nongiftableMax: 0,
      }
    );
  });

  it('pins the free count on a partial free spend and retries after a race', async () => {
    hasuraSystemService.executeQuery
      .mockResolvedValueOnce({ businesses_by_pk: { ai_tokens_nongiftable: 3 } })
      .mockResolvedValueOnce({ businesses_by_pk: { ai_tokens_nongiftable: 4 } });
    hasuraSystemService.executeMutation
      .mockResolvedValueOnce({ update_businesses: { returning: [] } })
      .mockResolvedValueOnce({
        update_businesses: { returning: [{ ai_tokens: 10 }] },
      });

    await expect(service.tryReserveTokens('business-1', 5)).resolves.toEqual({
      balanceAfter: 10,
      spentNongiftable: 4,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DebitAiTokens'),
      {
        id: 'business-1',
        cost: 5,
        delta: -5,
        nongiftableDelta: -3,
        nongiftableMin: 3,
        nongiftableMax: 3,
      }
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DebitAiTokens'),
      {
        id: 'business-1',
        cost: 5,
        delta: -5,
        nongiftableDelta: -4,
        nongiftableMin: 4,
        nongiftableMax: 4,
      }
    );
  });

  it('returns null when a reservation cannot debit enough tokens', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 20 },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses: { returning: [] },
    });

    await expect(service.tryReserveTokens('business-1', 1)).resolves.toBeNull();
  });

  it('grants the pack matching a successful token payment', async () => {
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_ai_token_usage_one: { id: 'claim-1' },
    });

    await service.processTokenPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 15,
      currency: 'CAD',
    });

    expect(grantPackTokens).toHaveBeenCalledWith('business-1', 1000, 'pay-1');
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertAiTokenPurchaseClaim'),
      {
        object: expect.objectContaining({
          business_id: 'business-1',
          tokens_consumed: 1000,
          operation_type: 'purchase',
          subject_type: 'token_pack',
          payment_reference: 'pay-1',
        }),
      }
    );
  });

  it('skips grant when the payment reference was already claimed', async () => {
    const grantPackTokens = jest
      .spyOn(service, 'grantPackTokens')
      .mockResolvedValue(undefined);
    hasuraSystemService.executeMutation.mockRejectedValue(
      new Error('Uniqueness violation')
    );

    await service.processTokenPaymentSuccess({
      entity_id: 'business-1',
      reference: 'pay-1',
      amount: 15,
      currency: 'CAD',
    });

    expect(grantPackTokens).not.toHaveBeenCalled();
  });

  it('releases the purchase claim when grant fails so retries can succeed', async () => {
    jest
      .spyOn(service, 'grantPackTokens')
      .mockRejectedValue(new Error('hasura down'));
    hasuraSystemService.executeMutation
      .mockResolvedValueOnce({
        insert_business_ai_token_usage_one: { id: 'claim-1' },
      })
      .mockResolvedValueOnce({
        delete_business_ai_token_usage: { affected_rows: 1 },
      });

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
    expect(mobilePaymentsDatabaseService.updateTransaction).toHaveBeenCalledWith(
      'mp-tx-1',
      { transaction_id: 'provider-tx-9' }
    );
  });

  it('marks the mobile payment failed when the provider rejects it', async () => {
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
    mobilePaymentsService.getProvider.mockReturnValue('freemopay');
    mobilePaymentsDatabaseService.createTransaction.mockResolvedValue({
      id: 'mp-tx-1',
    });
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: false,
      message: 'Payer declined',
      errorCode: 'DECLINED',
    });

    await expect(
      service.initiatePackPurchase({
        packId: 'pack_100',
        phoneNumber: '+237600000000',
      })
    ).rejects.toBeInstanceOf(HttpException);
    expect(mobilePaymentsDatabaseService.updateTransaction).toHaveBeenCalledWith(
      'mp-tx-1',
      {
        status: 'failed',
        error_message: 'Payer declined',
        error_code: 'DECLINED',
      }
    );
  });

  it('does not fail a successful charge that has no provider transaction id yet', async () => {
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
    mobilePaymentsService.initiatePayment.mockResolvedValue({ success: true });

    await expect(
      service.initiatePackPurchase({
        packId: 'pack_100',
        phoneNumber: '+237600000000',
      })
    ).resolves.toEqual(expect.objectContaining({ success: true, paymentPending: true }));
    expect(mobilePaymentsDatabaseService.updateTransaction).not.toHaveBeenCalled();
  });

  it('restores the free allotment when cleanup fails after spending it', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens_nongiftable: 2 },
    });
    hasuraSystemService.executeMutation.mockImplementation((query: string) => {
      if (query.includes('DebitAiTokens')) {
        return Promise.resolve({
          update_businesses: { returning: [{ ai_tokens: 19 }] },
        });
      }
      return Promise.resolve({ update_businesses_by_pk: { ai_tokens: 20 } });
    });

    await expect(
      service.runCleanupWithToken(tokenParams(), async () => {
        throw new Error('cleanup failed');
      })
    ).rejects.toThrow('cleanup failed');

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('RefundAiToken'),
      { id: 'business-1', amount: 1, nongiftable: 1 }
    );
  });

  it('clamps free tokens when the balance is set below that allotment', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens: 20, ai_tokens_nongiftable: 20 },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses_by_pk: { ai_tokens: 5 },
    });

    await expect(service.setTokens('business-1', 5)).resolves.toBe(5);
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetBusinessAiTokens'),
      { id: 'business-1', ai_tokens: 5, nongiftable: 5 }
    );
  });

  it('keeps free tokens when the new balance is higher', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens: 20, ai_tokens_nongiftable: 20 },
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses_by_pk: { ai_tokens: 40 },
    });

    await service.setTokens('business-1', 40);

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SetBusinessAiTokens'),
      { id: 'business-1', ai_tokens: 40, nongiftable: 20 }
    );
  });

  it('rejects a negative token total before writing', async () => {
    await expect(service.setTokens('business-1', -1)).rejects.toThrow(
      'non-negative'
    );
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('floors giftable at zero when free tokens exceed the balance', async () => {
    hasuraSystemService.executeQuery.mockResolvedValue({
      businesses_by_pk: { ai_tokens: 4, ai_tokens_nongiftable: 20 },
    });

    await expect(service.getBalanceDetails('business-1')).resolves.toEqual({
      ai_tokens: 4,
      ai_tokens_nongiftable: 20,
      giftable: 0,
    });
  });

  it('grants purchased packs onto the giftable balance only', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      update_businesses_by_pk: { ai_tokens: 1020 },
    });

    await service.grantPackTokens('business-1', 1000, 'pay-1');

    const [query, vars] = hasuraSystemService.executeMutation.mock.calls[0];
    expect(query).toContain('_inc: { ai_tokens: $amount }');
    expect(query).not.toContain('ai_tokens_nongiftable');
    expect(vars).toEqual({ id: 'business-1', amount: 1000 });
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
