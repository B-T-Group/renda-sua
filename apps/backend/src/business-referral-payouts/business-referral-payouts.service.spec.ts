import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

describe('BusinessReferralPayoutsService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const accountsService = {
    registerTransaction: jest.fn(),
    findDepositByReference: jest.fn(),
  };
  const paymentRoutingService = {
    getUserCountryCode: jest.fn(),
    resolveRailForUser: jest.fn(),
  };
  const notificationsService = {
    sendInternalPushByUserId: jest.fn(),
  };
  const configurationsService = {
    getConfigurationByKey: jest.fn(),
  };

  const business = {
    id: 'business-1',
    name: 'Demo Store',
    referred_by_agent_id: 'agent-1',
    agent: {
      id: 'agent-1',
      user_id: 'user-1',
      user: { id: 'user-1', preferred_language: 'en' },
    },
    items_aggregate: { aggregate: { count: 12 } },
  };

  let service: BusinessReferralPayoutsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessReferralPayoutsService(
      hasuraSystemService as never,
      accountsService as never,
      paymentRoutingService as never,
      notificationsService as never,
      configurationsService as never
    );

    configurationsService.getConfigurationByKey.mockImplementation(
      async (key: string) => {
        if (key === 'business_referral_payout_enabled') {
          return { boolean_value: true, status: 'active' };
        }
        if (key === 'business_referral_payout_amount') {
          return { number_value: 5000 };
        }
        return null;
      }
    );
    paymentRoutingService.getUserCountryCode.mockResolvedValue('CM');
    paymentRoutingService.resolveRailForUser.mockResolvedValue('mobile_money');
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('EligibleReferredBusinesses')) {
        return { businesses: [business] };
      }
      if (query.includes('GetAgentAccount')) {
        return { accounts: [{ id: 'account-1' }] };
      }
      return {};
    });
    accountsService.findDepositByReference.mockResolvedValue(null);
    notificationsService.sendInternalPushByUserId.mockResolvedValue(undefined);
  });

  it('does not mark a business paid when wallet credit fails', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-1' },
    });
    accountsService.registerTransaction.mockResolvedValue({
      success: false,
      error: 'Account not found',
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 0,
      skipped: 0,
      failures: 1,
    });
    expect(accountsService.registerTransaction).toHaveBeenCalledWith({
      accountId: 'account-1',
      amount: 5000,
      transactionType: 'deposit',
      memo: 'Business referral bonus',
      referenceId: 'business-1',
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ReleaseReferralPayoutClaim'),
      { businessId: 'business-1' }
    );
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
      expect.stringContaining('AttachReferralPayoutTransaction'),
      expect.anything()
    );
    expect(notificationsService.sendInternalPushByUserId).not.toHaveBeenCalled();
  });

  it('claims before credit and skips when another runner already claimed', async () => {
    hasuraSystemService.executeMutation.mockRejectedValue(
      new Error('Uniqueness violation on uq_business_referral_payouts_business_id')
    );

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 0,
      skipped: 1,
      failures: 0,
    });
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(notificationsService.sendInternalPushByUserId).not.toHaveBeenCalled();
  });

  it('reuses an existing deposit instead of double-crediting', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-1' },
      update_business_referral_payouts: { affected_rows: 1 },
    });
    accountsService.findDepositByReference.mockResolvedValue({ id: 'tx-existing' });

    const summary = await service.runWeeklyPayouts();

    expect(summary.credited).toBe(1);
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('AttachReferralPayoutTransaction'),
      { businessId: 'business-1', transactionId: 'tx-existing' }
    );
  });

  it('credits and attaches transaction id on success', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-1' },
      update_business_referral_payouts: { affected_rows: 1 },
    });
    accountsService.registerTransaction.mockResolvedValue({
      success: true,
      transactionId: 'tx-1',
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 1,
      skipped: 0,
      failures: 0,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('AttachReferralPayoutTransaction'),
      { businessId: 'business-1', transactionId: 'tx-1' }
    );
    expect(notificationsService.sendInternalPushByUserId).toHaveBeenCalled();
  });
});
