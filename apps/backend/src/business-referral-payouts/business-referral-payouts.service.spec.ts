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
  const representativeCompensationService = {
    sweepPending: jest.fn(),
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
      referralPyramidService as never,
      representativeCompensationService as never
    );
    representativeCompensationService.sweepPending.mockResolvedValue({
      credited: 0,
      skipped: 0,
      failed: 0,
    });

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

  it('sweeps compensation when enabled', async () => {
    representativeCompensationService.sweepPending.mockResolvedValue({
      credited: 2,
      skipped: 1,
      failed: 0,
    });

    const summary = await service.runWeeklyPayouts();

    expect(representativeCompensationService.sweepPending).toHaveBeenCalled();
    expect(summary).toEqual({
      processed: 3,
      credited: 2,
      skipped: 1,
      failures: 0,
    });
    expect(referralPyramidService.distributeReferralBonus).not.toHaveBeenCalled();
  });
});
