jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { AdminPerformanceService } from './admin-performance.service';

describe('AdminPerformanceService projected payouts', () => {
  let hasura: { executeQuery: jest.Mock };
  let configurations: { getConfigurationByKey: jest.Mock };
  let reviews: { getReviewStatusesForBusinessIds: jest.Mock };
  let service: AdminPerformanceService;

  const window = {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-08-31T00:00:00.000Z',
  };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    configurations = { getConfigurationByKey: jest.fn() };
    reviews = { getReviewStatusesForBusinessIds: jest.fn() };
    service = new AdminPerformanceService(
      hasura as any,
      configurations as any,
      reviews as any
    );
  });

  it('uses the internal rate only for users.internal agents', async () => {
    reviews.getReviewStatusesForBusinessIds.mockResolvedValue(
      new Map([
        ['b-int', approvedUnpaid()],
        ['b-ext', approvedUnpaid()],
        ['b-thin', approvedUnpaid()],
      ])
    );
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('AdminPerformanceAgentsByIds')) {
        return {
          agents: [
            agentRow('ag-int', true, 'CA'),
            agentRow('ag-ext', false, 'CA'),
          ],
        };
      }
      return {
        businesses: [
          referralRow('b-int', 'ag-int', 12),
          referralRow('b-ext', 'ag-ext', 12),
          referralRow('b-thin', 'ag-int', 3),
        ],
      };
    });
    configurations.getConfigurationByKey.mockImplementation(async (key: string) => {
      if (key === 'business_referral_payout_amount_internal') {
        return { number_value: 50 };
      }
      return { number_value: 20 };
    });

    const entries = await service.getTopAgents(window, 'business_referrals', 10);
    const internal = entries.find((e) => e.agentId === 'ag-int');
    const external = entries.find((e) => e.agentId === 'ag-ext');

    expect(internal?.isInternal).toBe(true);
    expect(internal?.projectedPayoutAmount).toBe(50);
    expect(internal?.projectedPayoutCurrency).toBe('CAD');
    expect(external?.isInternal).toBe(false);
    expect(external?.projectedPayoutAmount).toBe(20);
    expect(configurations.getConfigurationByKey).toHaveBeenCalledWith(
      'business_referral_payout_amount_internal',
      'CA'
    );
    expect(configurations.getConfigurationByKey).toHaveBeenCalledWith(
      'business_referral_payout_amount',
      'CA'
    );
  });

  it('skips projection when the country is missing or no approved unpaid stocked referral exists', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('AdminPerformanceAgentsByIds')) {
        return { agents: [agentRow('ag-1', true, null)] };
      }
      return { businesses: [referralRow('b-1', 'ag-1', 12)] };
    });
    reviews.getReviewStatusesForBusinessIds.mockResolvedValue(
      new Map([['b-1', approvedUnpaid()]])
    );

    const noCountry = await service.getTopAgents(window, 'business_referrals', 10);
    expect(noCountry[0].isInternal).toBe(true);
    expect(noCountry[0].projectedPayoutAmount).toBeUndefined();
    expect(configurations.getConfigurationByKey).not.toHaveBeenCalled();

    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('AdminPerformanceAgentsByIds')) {
        return { agents: [agentRow('ag-1', false, 'CM')] };
      }
      return { businesses: [referralRow('b-1', 'ag-1', 12)] };
    });
    reviews.getReviewStatusesForBusinessIds.mockResolvedValue(
      new Map([
        ['b-1', { payoutReviewStatus: 'approved', rejectionReason: null, isPaid: true }],
      ])
    );

    const paid = await service.getTopAgents(window, 'business_referrals', 10);
    expect(paid[0].projectedPayoutAmount).toBeUndefined();
    expect(configurations.getConfigurationByKey).not.toHaveBeenCalled();
  });

  it('fails open to no projection when payout config lookup throws', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('AdminPerformanceAgentsByIds')) {
        return { agents: [agentRow('ag-1', true, 'US')] };
      }
      return { businesses: [referralRow('b-1', 'ag-1', 15)] };
    });
    reviews.getReviewStatusesForBusinessIds.mockResolvedValue(
      new Map([['b-1', approvedUnpaid()]])
    );
    configurations.getConfigurationByKey.mockRejectedValue(new Error('hasura down'));

    const entries = await service.getTopAgents(window, 'business_referrals', 10);
    expect(entries[0].isInternal).toBe(true);
    expect(entries[0].projectedPayoutAmount).toBeUndefined();
  });

  function referralRow(id: string, agentId: string, itemCount: number) {
    return {
      id,
      name: id,
      created_at: '2026-08-02T00:00:00.000Z',
      referred_by_agent_id: agentId,
      items_aggregate: { aggregate: { count: itemCount } },
    };
  }

  function agentRow(id: string, internal: boolean, country: string | null) {
    return {
      id,
      agent_code: id,
      user: { first_name: 'A', last_name: 'Gent', internal },
      agent_addresses: country
        ? [{ address: { country } }]
        : [],
    };
  }

  function approvedUnpaid() {
    return {
      payoutReviewStatus: 'approved' as const,
      rejectionReason: null,
      isPaid: false,
    };
  }
});
