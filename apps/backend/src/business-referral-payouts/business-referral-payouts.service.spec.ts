jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

describe('BusinessReferralPayoutsService', () => {
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const paymentRoutingService = {
    getUserCountryCode: jest.fn(),
    resolveRailForUser: jest.fn(),
  };
  const configurationsService = {
    getConfigurationByKey: jest.fn(),
  };
  const referralPyramidService = {
    distributeReferralBonus: jest.fn(),
  };

  const business = {
    kind: 'agent' as const,
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
      paymentRoutingService as never,
      configurationsService as never,
      referralPyramidService as never
    );

    configurationsService.getConfigurationByKey.mockImplementation(
      async (key: string) => {
        if (key === 'business_referral_payout_enabled') {
          return { boolean_value: true, status: 'active' };
        }
        if (key === 'business_referral_payout_amount') {
          return { number_value: 5000 };
        }
        if (key === 'business_to_business_referral_amount') {
          return { number_value: 2000 };
        }
        return null;
      }
    );
    paymentRoutingService.getUserCountryCode.mockResolvedValue('CM');
    paymentRoutingService.resolveRailForUser.mockResolvedValue('mobile_money');
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('EligibleAgentReferredBusinesses')) {
        return { businesses: [business] };
      }
      if (query.includes('EligibleBusinessReferredBusinesses')) {
        return { businesses: [] };
      }
      if (query.includes('ReferrerPayoutUser')) {
        return { users_by_pk: { internal: false, agent: { id: 'agent-1' } } };
      }
      if (query.includes('GetPersonalAccount')) {
        return { accounts: [{ id: 'account-1' }] };
      }
      if (query.includes('EarnerAgentName')) {
        return {
          agents_by_pk: { user: { first_name: 'Ada', last_name: 'Agent' } },
        };
      }
      if (query.includes('IncompleteBusinessReferralPayouts')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });
  });

  it('does not mark a business paid when wallet credit fails', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-1' },
    });
    referralPyramidService.distributeReferralBonus.mockRejectedValue(
      new Error('Account not found')
    );
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('EligibleAgentReferredBusinesses')) {
        return { businesses: [business] };
      }
      if (query.includes('EligibleBusinessReferredBusinesses')) {
        return { businesses: [] };
      }
      if (query.includes('ReferrerPayoutUser')) {
        return { users_by_pk: { internal: false, agent: { id: 'agent-1' } } };
      }
      if (query.includes('GetPersonalAccount')) {
        return { accounts: [{ id: 'account-1' }] };
      }
      if (query.includes('EarnerAgentName')) {
        return {
          agents_by_pk: { user: { first_name: 'Ada', last_name: 'Agent' } },
        };
      }
      if (query.includes('IncompleteBusinessReferralPayouts')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary.failures).toBeGreaterThanOrEqual(1);
    expect(referralPyramidService.distributeReferralBonus).toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalledWith(
      expect.stringContaining('ReleaseReferralPayoutClaim'),
      expect.anything()
    );
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
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
  });

  it('credits via pyramid and attaches primary transaction id on success', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-1' },
      update_business_referral_payouts: { affected_rows: 1 },
    });
    referralPyramidService.distributeReferralBonus.mockResolvedValue({
      credited: 2,
      transactionIds: ['tx-earner', 'tx-gen1'],
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 1,
      skipped: 0,
      failures: 0,
    });
    expect(referralPyramidService.distributeReferralBonus).toHaveBeenCalledWith(
      expect.objectContaining({
        grossAmount: 5000,
        businessReferralPayoutId: 'payout-1',
        referred: {
          kind: 'business',
          id: 'business-1',
          name: 'Demo Store',
        },
      })
    );
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('AttachReferralPayoutTransaction'),
      { businessId: 'business-1', transactionId: 'tx-earner' }
    );
  });

  it('releases claim when pyramid credits nobody', async () => {
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-1' },
    });
    referralPyramidService.distributeReferralBonus.mockResolvedValue({
      credited: 0,
      transactionIds: [],
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 0,
      skipped: 1,
      failures: 0,
    });
    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('ReleaseReferralPayoutClaim'),
      { businessId: 'business-1' }
    );
  });

  it('credits 2000 XAF for a business-only referrer', async () => {
    const referred = {
      kind: 'business' as const,
      id: 'business-2',
      name: 'Referred Shop',
      referred_by_business_id: 'biz-ref-1',
      referring_business: {
        id: 'biz-ref-1',
        user_id: 'user-2',
        user: { id: 'user-2', preferred_language: 'en' },
      },
      items_aggregate: { aggregate: { count: 12 } },
    };
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('EligibleAgentReferredBusinesses')) {
        return { businesses: [] };
      }
      if (query.includes('EligibleBusinessReferredBusinesses')) {
        return { businesses: [referred] };
      }
      if (query.includes('ReferrerPayoutUser')) {
        return { users_by_pk: { internal: false, agent: null } };
      }
      if (query.includes('GetBusinessAccount')) {
        return { accounts: [{ id: 'biz-account-1' }] };
      }
      if (query.includes('EarnerBusinessName')) {
        return { businesses_by_pk: { name: 'Referrer Shop' } };
      }
      if (query.includes('IncompleteBusinessReferralPayouts')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_referral_payouts_one: { id: 'payout-2' },
      update_business_referral_payouts: { affected_rows: 1 },
    });
    referralPyramidService.distributeReferralBonus.mockResolvedValue({
      credited: 1,
      transactionIds: ['tx-b2b'],
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary.credited).toBe(1);
    expect(referralPyramidService.distributeReferralBonus).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: 2000 })
    );
  });

  it('skips payout when referrer lookup fails instead of guessing a rate', async () => {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('EligibleAgentReferredBusinesses')) {
        return { businesses: [business] };
      }
      if (query.includes('EligibleBusinessReferredBusinesses')) {
        return { businesses: [] };
      }
      if (query.includes('ReferrerPayoutUser')) {
        throw new Error('Hasura timeout');
      }
      if (query.includes('IncompleteBusinessReferralPayouts')) {
        return { business_referral_payouts: [] };
      }
      return {};
    });

    const summary = await service.runWeeklyPayouts();

    expect(summary).toEqual({
      processed: 1,
      credited: 0,
      skipped: 1,
      failures: 0,
    });
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
  });
});
