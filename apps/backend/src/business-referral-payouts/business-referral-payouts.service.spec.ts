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

  it('counts only catalog items created after referral attribution', async () => {
    const appliedAt = '2026-10-01T00:00:00.000Z';
    const agentBase = {
      name: 'Late Shop',
      referred_by_agent_id: 'agent-1',
      agent: business.agent,
      items_aggregate: { aggregate: { count: 40 } },
    };
    hasuraSystemService.executeQuery.mockImplementation(async (query: string, vars?: { businessId?: string }) => {
      if (query.includes('EligibleAgentReferredBusinesses')) {
        expect(query).toContain('referral_applied_at: { _is_null: false }');
        return {
          businesses: [
            { ...agentBase, id: 'biz-ready', referral_applied_at: appliedAt },
            { ...agentBase, id: 'biz-unstamped', referral_applied_at: null },
            { ...agentBase, id: 'biz-thin', referral_applied_at: appliedAt },
          ],
        };
      }
      if (query.includes('EligibleBusinessReferredBusinesses')) {
        expect(query).toContain('referral_applied_at: { _is_null: false }');
        return {
          businesses: [
            {
              id: 'biz-b2b',
              name: 'B2B Shop',
              referred_by_business_id: 'biz-ref',
              referral_applied_at: appliedAt,
              referring_business: {
                id: 'biz-ref',
                name: 'Referrer',
                user_id: 'user-2',
                user: { id: 'user-2', preferred_language: 'fr' },
              },
              items_aggregate: { aggregate: { count: 12 } },
            },
          ],
        };
      }
      if (query.includes('CountItemsSinceReferral')) {
        const counts: Record<string, number> = {
          'biz-ready': 10,
          'biz-thin': 9,
          'biz-b2b': 10,
        };
        return {
          items_aggregate: {
            aggregate: { count: counts[vars?.businessId ?? ''] ?? 0 },
          },
        };
      }
      return {};
    });

    const rows = await service.listEligibleForPreview();

    expect(rows.map((row) => row.id)).toEqual(['biz-ready', 'biz-b2b']);
    expect(rows.map((row) => row.itemCount)).toEqual([10, 10]);
    const sinceCalls = hasuraSystemService.executeQuery.mock.calls
      .filter((call) => String(call[0]).includes('CountItemsSinceReferral'))
      .map((call) => call[1]);
    expect(sinceCalls).toHaveLength(3);
    expect(sinceCalls).toEqual(
      expect.arrayContaining([
        { businessId: 'biz-ready', since: appliedAt },
        { businessId: 'biz-thin', since: appliedAt },
        { businessId: 'biz-b2b', since: appliedAt },
      ])
    );
    expect(sinceCalls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ businessId: 'biz-unstamped' }),
      ])
    );
  });
});
