import { AdminPlatformMetricsService } from './admin-platform-metrics.service';

function count(value: number) {
  return { aggregate: { count: value } };
}

function money(field: 'total_amount' | 'amount', value: number | string, n = 0) {
  return { aggregate: { count: n, sum: { [field]: value } } };
}

describe('AdminPlatformMetricsService', () => {
  const hasura = { executeQuery: jest.fn() };
  let service: AdminPlatformMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminPlatformMetricsService(hasura as never);
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AdminPlatformOrderCurrencies')) {
        return { orders: [{ currency: 'XAF' }, { currency: 'CAD' }, { currency: 'bad' }] };
      }
      if (query.includes('AdminPlatformOrderMetrics')) return orderMetrics();
      if (query.includes('AdminPlatformPayoutCurrencies')) return payoutCurrencies();
      if (query.includes('AdminPlatformPayoutAggregates')) return payoutAggregates();
      if (query.includes('AdminPlatformTopStores')) return { business_locations: stores() };
      return {};
    });
  });

  it('groups orders, sales, and payouts by currency and ranks stores', async () => {
    const actual = await service.getPlatformMetrics({
      from: '2026-01-01T00:00:00Z',
      to: '2026-02-01T00:00:00Z',
      countryCode: 'CM',
    });

    expect(actual.orders).toEqual({
      total: 10,
      completed: 4,
      cancelled: 2,
      failed: 1,
      refunds: 1,
      pendingPayment: 1,
      inProgress: 1,
      completionRate: 40,
      cancellationRate: 20,
      uniqueClients: 7,
      byFulfillment: { delivery: 6, pickup: 3, shipping: 1 },
    });
    expect(actual.sales).toEqual([
      { currency: 'CAD', gmv: 0, collected: 90, completedCount: 0, averageOrderValue: 0 },
      {
        currency: 'XAF',
        gmv: 8000,
        collected: 5000,
        completedCount: 4,
        averageOrderValue: 2000,
      },
    ]);
    expect(actual.payouts).toEqual([
      {
        currency: 'CAD',
        platformRevenue: 100,
        agentDeliveryPay: 40,
        partnerCommissions: 10,
        merchantPayouts: 200,
        platformFundedDelivery: 5,
        referralCompensation: 0,
      },
      {
        currency: 'XAF',
        platformRevenue: 0,
        agentDeliveryPay: 0,
        partnerCommissions: 0,
        merchantPayouts: 0,
        platformFundedDelivery: 0,
        referralCompensation: 10000,
      },
    ]);
    expect(actual.topStores.map((store) => store.businessLocationId)).toEqual([
      'loc-c',
      'loc-b',
      'loc-a',
    ]);
    expect(actual.topStores[0].referrer).toEqual({
      kind: 'business',
      name: 'Parent Shop',
      code: 'P1',
    });
    expect(actual.topStores[1].referrer).toEqual({
      kind: 'agent',
      name: 'Ada Agent',
      code: 'A1',
    });
    expect(actual.topStores[2].referrer).toBeNull();
    const metricsQuery = queryNamed('AdminPlatformOrderMetrics');
    expect(metricsQuery).toContain('$country: String!');
    expect(metricsQuery).toContain('$cur_XAF: String!');
    expect(variablesFor('AdminPlatformOrderMetrics')).toMatchObject({
      country: 'CM',
      cur_XAF: 'XAF',
      cur_CAD: 'CAD',
    });
  });

  it('skips payout aggregates when the window has no payout currencies', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AdminPlatformPayoutCurrencies')) {
        return {
          commission_payouts: [],
          representative_compensation_events: [],
          business_referral_payouts: [],
        };
      }
      if (query.includes('AdminPlatformOrderCurrencies')) return { orders: [] };
      if (query.includes('AdminPlatformOrderMetrics')) return orderMetrics();
      if (query.includes('AdminPlatformTopStores')) return { business_locations: [] };
      return {};
    });

    const actual = await service.getPlatformMetrics({
      from: '2026-01-01T00:00:00Z',
      to: '2026-02-01T00:00:00Z',
    });

    expect(actual.sales).toEqual([]);
    expect(actual.payouts).toEqual([]);
    expect(actual.orders.completionRate).toBe(40);
    expect(queryNamed('AdminPlatformPayoutAggregates')).toBeUndefined();
  });

  function queryNamed(name: string): string | undefined {
    const call = hasura.executeQuery.mock.calls.find((args) =>
      String(args[0]).includes(name)
    );
    return call ? String(call[0]) : undefined;
  }

  function variablesFor(name: string): Record<string, unknown> {
    const call = hasura.executeQuery.mock.calls.find((args) =>
      String(args[0]).includes(name)
    );
    return (call?.[1] ?? {}) as Record<string, unknown>;
  }
});

function orderMetrics() {
  return {
    total: count(10),
    completed: count(4),
    cancelled: count(2),
    failed: count(1),
    refunds: count(1),
    pendingPayment: count(1),
    uniqueClients: count(7),
    delivery: count(6),
    pickup: count(3),
    shipping: count(1),
    gmv_XAF: money('total_amount', '8000', 4),
    collected_XAF: money('total_amount', 5000),
    gmv_CAD: money('total_amount', 0, 0),
    collected_CAD: money('total_amount', 90),
  };
}

function payoutCurrencies() {
  return {
    commission_payouts: [{ currency: 'CAD' }],
    representative_compensation_events: [{ currency: 'XAF' }],
    business_referral_payouts: [{ currency: 'XAF' }],
  };
}

function payoutAggregates() {
  return {
    platform_CAD: money('amount', 100),
    subsidy_CAD: money('amount', 5),
    agent_CAD: money('amount', 40),
    partner_CAD: money('amount', 10),
    merchant_CAD: money('amount', 200),
    comp_XAF: money('amount', '7500'),
    bonus_XAF: money('amount', 2500),
  };
}

function stores() {
  return [
    store('loc-a', 2, 100, null, null),
    store('loc-b', 9, 50, agent(), null),
    store('loc-c', 9, 80, null, { name: 'Parent Shop', business_code: 'P1' }),
  ];
}

function agent() {
  return {
    agent_code: 'A1',
    user: { first_name: 'Ada', last_name: 'Agent' },
  };
}

function store(
  id: string,
  orderCount: number,
  gmv: number,
  referringAgent: ReturnType<typeof agent> | null,
  referringBusiness: { name: string; business_code: string } | null
) {
  return {
    id,
    name: id,
    business: {
      id: `biz-${id}`,
      name: `Biz ${id}`,
      referring_agent: referringAgent,
      referring_business: referringBusiness,
    },
    orders_aggregate: count(orderCount),
    completed: money('total_amount', gmv, orderCount),
    orders: [{ currency: 'XAF' }],
  };
}
