import { RepresentativeCommissionService, type AccrualOrder } from './representative-commission.service';
import type { StoredCommissionGrid } from './representative-commission-grid.service';

function openGrid(): StoredCommissionGrid {
  return {
    id: 'grid-1',
    currency: 'XAF',
    basePercent: 10,
    capPercent: 13,
    holdPercent: 10,
    holdDays: 90,
    registrationTarget: 40,
    objectiveThresholdPercent: 70,
    activationAmount: 4000,
    tiers: [],
    activationMinSales: 2500,
    activationWindowDays: 30,
    fastStartAmount: 0,
    fastStartMinRegistrations: 0,
    fastStartWindowDays: 90,
    fastStartWeeklySales: 0,
    quarterlyAmount: 0,
    quarterlyMinWeeks: 0,
    quarterlyWeekSpan: 0,
    quarterlyMinRegistrationsPerWeek: 0,
    quarterlyMinWeeklySales: 0,
    courierAmount: 5000,
    courierMinDeliveries: 1,
    courierWindowDays: 60,
    courierMaxPerMonth: 2,
    ambassadorAmount: 0,
    ambassadorMinRegistrations: 1,
    ambassadorWindowDays: 60,
    inactiveDays: 90,
  };
}

const FROZEN = new Date('2026-10-13T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('RepresentativeCommissionService.accrue', () => {
  const hasura = { executeQuery: jest.fn() };
  const configurations = {
    getConfigurationByKey: jest.fn(),
    // Global lookup = the country-less read (country_code IS NULL).
    getGlobalConfigurationByKey: jest.fn((key: string) =>
      configurations.getConfigurationByKey(key, undefined)
    ),
  };
  const grids = { loadFor: jest.fn() };
  const accounts = { registerDepositIfNotExists: jest.fn() };
  const service = new RepresentativeCommissionService(
    hasura as never,
    configurations as never,
    grids as never,
    accounts as never,
    { getUserCountryCode: jest.fn() } as never
  );
  const previousEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN);
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    grids.loadFor.mockResolvedValue(openGrid());
    hasura.executeQuery.mockImplementation(async (query: string) => answer(query));
  });

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
    jest.useRealTimers();
  });

  it('does not accrue when the country flag is off, even if the global flag is on', async () => {
    configurations.getConfigurationByKey.mockImplementation(async (_key: string, country?: string) => {
      if (country === 'CM') return { boolean_value: false, status: 'active' };
      return { boolean_value: true, status: 'active' };
    });
    await service.accrue(order());
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(0);
    expect(named(hasura, 'PortfolioBusiness')).toHaveLength(0);
  });

  it('accrues after a thrown country lookup falls back to an active global flag', async () => {
    configurations.getConfigurationByKey.mockImplementation(async (_key: string, country?: string) => {
      if (country) throw new Error('no country row');
      return { boolean_value: true, status: 'active' };
    });
    await service.accrue(order());
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(1);
  });

  it('uses the sale completion time for the production cutover', async () => {
    await service.accrue(order({ completedAt: '2026-10-31T22:00:00.000Z' }));
    expect(grids.loadFor).not.toHaveBeenCalled();

    await service.accrue(order({ completedAt: '2026-11-02T00:00:00.000Z' }));
    expect(grids.loadFor).toHaveBeenCalledWith('XAF', new Date('2026-11-02T00:00:00.000Z'));
  });

  it('skips a shop with no referring agent, no agreement, an exit, or a grid', async () => {
    hasura.executeQuery.mockResolvedValueOnce(business({ referred_by_agent_id: null }));
    await service.accrue(order());
    hasura.executeQuery.mockResolvedValueOnce(
      business({ merchant_agreement_accepted_at: null })
    );
    await service.accrue(order());
    hasura.executeQuery.mockResolvedValueOnce({
      ...business(),
      representative_portfolio_exits_by_pk: { business_id: 'biz-1' },
    });
    await service.accrue(order());
    expect(named(hasura, 'AgentContractEnd')).toHaveLength(0);
    grids.loadFor.mockResolvedValueOnce(null);
    hasura.executeQuery.mockResolvedValueOnce(business());
    await service.accrue(order());
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(0);
  });

  it('drops the shop when the agent agreement has already ended', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AgentContractEnd')) {
        return { agent_contracts: [{ cancelled_at: FROZEN.toISOString(), expired_at: null }] };
      }
      return answer(query);
    });
    await service.accrue(order());
    expect(named(hasura, 'LastPortfolioSale')).toHaveLength(0);
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(0);

    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('AgentContractEnd')) {
        return { agent_contracts: [{ cancelled_at: 'not-a-date', expired_at: null }] };
      }
      return answer(query);
    });
    await service.accrue(order());
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(1);
  });

  it('exits a shop that has been idle for 90 days and keeps one that sold 1ms sooner', async () => {
    // Past the production cutover so a 90-day-old sale is still in scope.
    const now = new Date('2027-03-01T12:00:00.000Z');
    jest.setSystemTime(now);
    const idle = new Date(now.getTime() - 90 * DAY_MS).toISOString();
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('LastPortfolioSale')) return { orders: [{ completed_at: idle }] };
      return answer(query);
    });
    // The accruing sale itself is activity (#560), so the idle case needs a
    // sale that is itself at least 90 days old.
    await service.accrue(order({ completedAt: idle }));
    expect(named(hasura, 'ExitPortfolio')[0][1].object.reason).toBe('inactive_90_days');
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(0);

    const active = new Date(now.getTime() - 90 * DAY_MS + 1).toISOString();
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('LastPortfolioSale')) return { orders: [{ completed_at: active }] };
      return answer(query);
    });
    await service.accrue(order());
    expect(named(hasura, 'InsertPortfolioAccrual')).toHaveLength(1);
  });

  it('stores a normal net, zeroes a self purchase, and floors a negative subtotal', async () => {
    await service.accrue(order());
    expect(accrualObject(hasura)).toEqual(
      expect.objectContaining({
        eligible_amount: 3700,
        gmv_amount: 20000,
        uncollected_delivery: 300,
        self_purchase: false,
        status: 'open',
      })
    );

    await service.accrue(order({ clientUserId: 'agent-user', subtotal: -50 }));
    expect(accrualObject(hasura, 1)).toEqual(
      expect.objectContaining({ eligible_amount: 0, gmv_amount: 0, self_purchase: true })
    );

    await service.accrue(
      order({ clientUserId: null, subtotal: -50, itemCommission: 1000, firstOrderDiscount: 0 })
    );
    expect(accrualObject(hasura, 2)).toEqual(
      expect.objectContaining({ eligible_amount: 1000, gmv_amount: 0, self_purchase: false })
    );
  });

  it('returns null from the pay board when the month cannot be read', async () => {
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: false,
      status: 'active',
    });
    await expect(service.previewForAgent('agent-1', 'XAF', 'CM')).resolves.toBeNull();
    hasura.executeQuery.mockRejectedValue(new Error('down'));
    await expect(service.boardTotals('agent-1', 'XAF', 'CM')).resolves.toBeNull();
  });
});

function order(overrides: Partial<AccrualOrder> = {}): AccrualOrder {
  return {
    orderId: 'order-1',
    businessId: 'biz-1',
    currency: 'XAF',
    subtotal: 20000,
    itemCommission: 4000,
    deliveryFeeWaived: false,
    baseDeliveryFee: 500,
    perKmDeliveryFee: 200,
    firstOrderDiscount: 300,
    clientUserId: 'client-1',
    countryCode: 'CM',
    completedAt: '2026-11-02T00:00:00.000Z',
    ...overrides,
  };
}

function business(overrides: Record<string, unknown> = {}) {
  return {
    businesses_by_pk: {
      id: 'biz-1',
      referred_by_agent_id: 'agent-1',
      merchant_agreement_accepted_at: '2026-08-01T00:00:00.000Z',
      referring_agent: { id: 'agent-1', user_id: 'agent-user' },
      ...overrides,
    },
    representative_portfolio_exits_by_pk: null,
  };
}

function answer(query: string) {
  if (query.includes('PortfolioBusiness')) return business();
  if (query.includes('AgentContractEnd')) return { agent_contracts: [] };
  if (query.includes('LastPortfolioSale')) {
    return { orders: [{ completed_at: FROZEN.toISOString() }] };
  }
  if (query.includes('InsertPortfolioAccrual')) {
    return { insert_representative_commission_accruals_one: { id: 'acc-1' } };
  }
  if (query.includes('ExitPortfolio')) {
    return { insert_representative_portfolio_exits_one: { business_id: 'biz-1' } };
  }
  throw new Error(`unexpected query ${query.slice(0, 80)}`);
}

function named(hasura: { executeQuery: jest.Mock }, token: string) {
  return hasura.executeQuery.mock.calls.filter((call) => String(call[0]).includes(token));
}

function accrualObject(hasura: { executeQuery: jest.Mock }, index = 0) {
  return named(hasura, 'InsertPortfolioAccrual')[index][1].object;
}
