import { AdminPerformanceService } from './admin-performance.service';

describe('AdminPerformanceService referral earnings', () => {
  const hasuraSystemService = { executeQuery: jest.fn() };
  const referralReviewService = { getReviewStatusesForBusinessIds: jest.fn() };
  let service: AdminPerformanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminPerformanceService(
      hasuraSystemService as never,
      referralReviewService as never
    );
    referralReviewService.getReviewStatusesForBusinessIds.mockResolvedValue(
      new Map([
        [
          'biz-1',
          {
            payoutReviewStatus: 'approved',
            rejectionReason: null,
            isPaid: true,
          },
        ],
      ])
    );
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AdminPerformanceReferredBusinesses')) {
        return {
          businesses: [
            {
              id: 'biz-1',
              name: 'Shop One',
              created_at: '2026-05-01T00:00:00Z',
              referred_by_agent_id: 'agent-1',
              items_aggregate: { aggregate: { count: 12 } },
            },
          ],
        };
      }
      if (query.includes('AdminPerformanceAgentsByIds')) {
        return {
          agents: [
            {
              id: 'agent-1',
              agent_code: 'A1',
              user: { first_name: 'Ada', last_name: 'Agent', internal: false },
              agent_addresses: [{ address: { country: 'CM' } }],
            },
          ],
        };
      }
      if (query.includes('AdminPerformanceAgentEarnings')) {
        return {
          representative_compensation_events: [
            {
              earner_agent_id: 'agent-1',
              business_id: 'biz-1',
              amount: '7500',
              currency: 'XAF',
            },
            {
              earner_agent_id: 'agent-1',
              business_id: 'biz-1',
              amount: 75,
              currency: 'XAF',
            },
          ],
        };
      }
      if (query.includes('AdminPerformanceAgentPending')) {
        return {
          representative_compensation_events: [
            {
              earner_agent_id: 'agent-1',
              business_id: 'biz-2',
              amount: '7500',
              currency: 'XAF',
            },
          ],
        };
      }
      return {};
    });
  });

  it('attaches credited compensation totals for the selected window', async () => {
    const agents = await service.getTopAgents(
      {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-31T23:59:59.000Z',
        countryCode: 'CM',
      },
      'business_referrals',
      10
    );

    expect(agents[0].earnedAmount).toBe(7575);
    expect(agents[0].earnedCurrency).toBe('XAF');
    expect(agents[0].referredBusinesses?.[0].earnedAmount).toBe(7575);
    expect(
      hasuraSystemService.executeQuery.mock.calls.some((call) =>
        String(call[0]).includes('AdminPerformanceAgentEarnings')
      )
    ).toBe(true);
  });

  it('attaches upcoming from pending compensation events', async () => {
    const agents = await service.getTopAgents(
      {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-31T23:59:59.000Z',
        countryCode: 'CM',
      },
      'business_referrals',
      10
    );

    expect(agents[0].projectedPayoutAmount).toBe(7500);
    expect(agents[0].projectedPayoutCurrency).toBe('XAF');
    expect(
      hasuraSystemService.executeQuery.mock.calls.some((call) =>
        String(call[0]).includes('AdminPerformanceAgentPending')
      )
    ).toBe(true);
  });
});
