import { Logger } from '@nestjs/common';
import { AdminPlatformMetricsService } from './admin-platform-metrics.service';

function count(value: number) {
  return { aggregate: { count: value } };
}

function money(
  field: 'total_amount' | 'amount',
  value: number | string,
  n = 0
) {
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
        return {
          orders: [
            { currency: 'XAF' },
            { currency: 'CAD' },
            { currency: 'bad' },
          ],
        };
      }
      if (query.includes('AdminPlatformOrderMetrics')) return orderMetrics();
      if (query.includes('AdminPlatformPayoutCurrencies'))
        return payoutCurrencies();
      if (query.includes('AdminPlatformPayoutAggregates'))
        return payoutAggregates();
      if (query.includes('AdminPlatformTopStores'))
        return { business_locations: stores() };
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
      {
        currency: 'CAD',
        gmv: 0,
        collected: 90,
        completedCount: 0,
        averageOrderValue: 0,
      },
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
      if (query.includes('AdminPlatformTopStores'))
        return { business_locations: [] };
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
    expect(queryNamed('AdminPlatformOrderMetrics')).not.toContain('$country');
    expect(
      variablesFor('AdminPlatformOrderCurrencies').country
    ).toBeUndefined();
  });

  it('clamps in-progress at zero and returns zero rates for an empty window', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AdminPlatformOrderCurrencies')) return { orders: [] };
      if (query.includes('AdminPlatformOrderMetrics')) {
        return {
          total: count(3),
          completed: count(2),
          cancelled: count(2),
          failed: count(0),
          refunds: count(0),
          pendingPayment: count(0),
          uniqueClients: count(0),
          delivery: count(0),
          pickup: count(0),
          shipping: count(0),
        };
      }
      if (query.includes('AdminPlatformPayoutCurrencies'))
        return emptyPayouts();
      if (query.includes('AdminPlatformTopStores'))
        return { business_locations: [] };
      return {};
    });

    const over = await service.getPlatformMetrics(window());
    expect(over.orders.inProgress).toBe(0);
    expect(over.orders.completionRate).toBeCloseTo(66.7);

    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AdminPlatformOrderCurrencies')) return { orders: [] };
      if (query.includes('AdminPlatformOrderMetrics')) return {};
      if (query.includes('AdminPlatformPayoutCurrencies'))
        return emptyPayouts();
      if (query.includes('AdminPlatformTopStores'))
        return { business_locations: [] };
      return {};
    });
    const empty = await service.getPlatformMetrics(window());
    expect(empty.orders).toMatchObject({
      total: 0,
      inProgress: 0,
      completionRate: 0,
      cancellationRate: 0,
    });
  });

  it('drops invalid currencies and treats non-finite money as zero', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AdminPlatformOrderCurrencies')) {
        return {
          orders: [
            { currency: 'xaf' },
            { currency: 'XAF' },
            { currency: 'XAF' },
            { currency: '' },
            { currency: 'US' },
            { currency: 'CAD' },
          ],
        };
      }
      if (query.includes('AdminPlatformOrderMetrics')) {
        return {
          ...orderMetrics(),
          gmv_XAF: money('total_amount', 'nope', 2),
          collected_CAD: money('total_amount', 'Infinity'),
        };
      }
      if (query.includes('AdminPlatformPayoutCurrencies')) {
        return {
          commission_payouts: [{ currency: 'XAF' }],
          representative_compensation_events: [],
          business_referral_payouts: [],
        };
      }
      if (query.includes('AdminPlatformPayoutAggregates')) {
        return {
          comp_XAF: money('amount', 0.1),
          bonus_XAF: money('amount', 0.2),
        };
      }
      if (query.includes('AdminPlatformTopStores')) {
        return {
          business_locations: [
            store(
              'loc-both',
              4,
              10,
              { agent_code: 'A9', user: null },
              { name: 'Parent Shop', business_code: 'P1' }
            ),
          ],
        };
      }
      return {};
    });

    const actual = await service.getPlatformMetrics({
      ...window(),
      countryCode: 'CM',
    });

    expect(actual.sales.map((row) => row.currency)).toEqual(['CAD', 'XAF']);
    expect(actual.sales.find((row) => row.currency === 'XAF')?.gmv).toBe(0);
    expect(actual.sales.find((row) => row.currency === 'CAD')?.collected).toBe(
      0
    );
    expect(actual.payouts).toEqual([
      expect.objectContaining({ currency: 'XAF', referralCompensation: 0.3 }),
    ]);
    expect(actual.topStores[0].referrer).toEqual({
      kind: 'agent',
      name: 'A9',
      code: 'A9',
    });
  });

  it('stops store paging on a short page and warns when the cap is hit', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      let pages = 0;
      hasura.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('AdminPlatformTopStores')) {
          pages += 1;
          const size = pages === 1 ? 1000 : 1;
          return { business_locations: manyStores(size, pages) };
        }
        return quietMetrics(query);
      });

      const first = await service.getPlatformMetrics(window());
      expect(pages).toBe(2);
      expect(first.topStores).toHaveLength(5);
      expect(warn).not.toHaveBeenCalled();

      pages = 0;
      warn.mockClear();
      hasura.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('AdminPlatformTopStores')) {
          pages += 1;
          return { business_locations: manyStores(1000, pages) };
        }
        return quietMetrics(query);
      });
      await service.getPlatformMetrics(window());
      expect(pages).toBe(20);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('Top stores pagination cap reached')
      );
    } finally {
      warn.mockRestore();
    }
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

function window() {
  return { from: '2026-01-01T00:00:00Z', to: '2026-02-01T00:00:00Z' };
}

function emptyPayouts() {
  return {
    commission_payouts: [],
    representative_compensation_events: [],
    business_referral_payouts: [],
  };
}

function manyStores(count: number, page: number) {
  return Array.from({ length: count }, (_, index) =>
    store(`p${page}-${index}`, count - index, index, null, null)
  );
}

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

function quietMetrics(query: string) {
  if (query.includes('AdminPlatformOrderCurrencies')) return { orders: [] };
  if (query.includes('AdminPlatformOrderMetrics')) return {};
  if (query.includes('AdminPlatformPayoutCurrencies')) return emptyPayouts();
  return {};
}

function store(
  id: string,
  orderCount: number,
  gmv: number,
  referringAgent: {
    agent_code: string | null;
    user: { first_name: string | null; last_name: string | null } | null;
  } | null,
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
