import { referralReferenceUuid } from '../referrals/referral-pyramid.util';
import type { StoredCommissionGrid } from './representative-commission-grid.service';
import { RepresentativeCommissionService } from './representative-commission.service';

const FROZEN = new Date('2026-10-13T12:00:00.000Z');

describe('RepresentativeCommissionService month close', () => {
  let statement: { id: string; status: string } | null = null;
  let accountId: string | null = 'acct-1';
  const hasura = { executeQuery: jest.fn() };
  const configurations = { getConfigurationByKey: jest.fn() };
  const grids = { loadFor: jest.fn() };
  const accounts = { registerDepositIfNotExists: jest.fn() };
  const paymentRouting = { getUserCountryCode: jest.fn() };
  const service = new RepresentativeCommissionService(
    hasura as never,
    configurations as never,
    grids as never,
    accounts as never,
    paymentRouting as never
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN);
    jest.clearAllMocks();
    statement = null;
    accountId = 'acct-1';
    grids.loadFor.mockResolvedValue(grid());
    accounts.registerDepositIfNotExists.mockResolvedValue({ success: true });
    paymentRouting.getUserCountryCode.mockResolvedValue('CM');
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: true,
      status: 'active',
    });
    route(hasura, base());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not close or pay while the portfolio flag is off', async () => {
    configurations.getConfigurationByKey.mockResolvedValue({
      boolean_value: false,
      status: 'active',
    });
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(hasura.executeQuery.mock.calls.some(([query]) =>
      String(query).includes('InsertPortfolioStatement')
    )).toBe(false);
    expect(hasura.executeQuery.mock.calls.some(([query]) =>
      String(query).includes('InsertPortfolioPremium')
    )).toBe(false);
  });

  it('does not open a statement for an empty month, but checks the flag', async () => {
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(named(hasura, 'InsertPortfolioStatement')).toHaveLength(0);
    expect(configurations.getConfigurationByKey).toHaveBeenCalled();
  });

  it('does not write a statement when the month has no grid', async () => {
    grids.loadFor.mockResolvedValue(null);
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(named(hasura, 'ZeroDeadAccruals')).toHaveLength(0);
    expect(named(hasura, 'InsertPortfolioStatement')).toHaveLength(0);
  });

  it('uses the grid still open at the last millisecond of the month', async () => {
    grids.loadFor.mockResolvedValueOnce(null).mockResolvedValueOnce(grid());
    await service.closePreviousMonth();
    expect(grids.loadFor).toHaveBeenNthCalledWith(1, 'XAF', new Date('2026-09-01T11:00:00.000Z'));
    expect(grids.loadFor).toHaveBeenNthCalledWith(
      2,
      'XAF',
      new Date('2026-09-30T22:59:59.999Z')
    );
  });

  it('closes each agent and currency once', async () => {
    route(hasura, {
      ...base(),
      AgentsInPortfolioPeriod: {
        representative_commission_accruals: [
          { agent_id: 'agent-1', currency: 'XAF' },
          { agent_id: 'agent-1', currency: 'XAF' },
        ],
      },
      OpenPortfolioStatements: {
        representative_commission_statements: [{ agent_id: 'agent-1', currency: 'XAF' }],
      },
    });
    await service.closePreviousMonth();
    expect(named(hasura, 'ZeroDeadAccruals')).toHaveLength(1);
  });

  it('does not pay a credited statement again', async () => {
    route(hasura, {
      ...base(),
      LoadPortfolioStatement: {
        representative_commission_statements: [{ id: 'stmt-9', status: 'credited' }],
      },
    });
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(grids.loadFor).not.toHaveBeenCalled();
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
  });

  it('closes a self-purchase month at zero without a deposit', async () => {
    route(hasura, { ...base(), SumPortfolioAccruals: selfPurchaseRows() });
    await expect(service.closePreviousMonth()).resolves.toBe(1);
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(insertedStatement(hasura)).toEqual(
      expect.objectContaining({ payable_amount: 0, hold_amount: 0, gmv_total: 0 })
    );
    expect(named(hasura, 'CreditPortfolioStatement')).toHaveLength(1);
  });

  it('keeps an open statement when the wallet is missing, then pays it once', async () => {
    accountId = null;
    route(hasura, { ...base(), SumPortfolioAccruals: eligibleRows() });
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(insertedStatement(hasura)).toEqual(
      expect.objectContaining({ payable_amount: 900, hold_amount: 100, status: 'open' })
    );
    expect(named(hasura, 'CreditPortfolioStatement')).toHaveLength(0);
    expect(named(hasura, 'InsertPortfolioHold')).toHaveLength(0);

    accountId = 'acct-1';
    await expect(service.closePreviousMonth()).resolves.toBe(1);
    expect(accounts.registerDepositIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 900,
      memo: 'Portfolio commission',
      referenceId: referralReferenceUuid('portfolio:stmt-1:pay'),
    });
    expect(named(hasura, 'InsertPortfolioHold')[0][1].object).toEqual(
      expect.objectContaining({
        amount: 100,
        remaining: 100,
        release_at: '2027-01-11T12:00:00.000Z',
        status: 'held',
      })
    );
    expect(named(hasura, 'UpdatePortfolioStatement')).toHaveLength(1);
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(accounts.registerDepositIfNotExists).toHaveBeenCalledTimes(1);
  });

  it('does not deposit when the statement insert loses a race', async () => {
    route(hasura, {
      ...base(),
      SumPortfolioAccruals: eligibleRows(),
      InsertPortfolioStatement: { insert_representative_commission_statements_one: null },
    });
    await expect(service.closePreviousMonth()).resolves.toBe(0);
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
  });

  it('pays the two earliest couriers when the registration objective is missed', async () => {
    route(hasura, { ...base(), SumPortfolioAccruals: eligibleRows(), ...courierHandlers() });
    await expect(service.closePreviousMonth()).resolves.toBe(1);
    const amounts = accounts.registerDepositIfNotExists.mock.calls.map((call) => call[0].amount);
    expect(amounts).toEqual([900, 10000]);
    expect(premiumObjects(hasura)).toEqual([
      expect.objectContaining({
        kind: 'activation',
        subject_id: 'biz-act',
        status: 'lost',
        paid_amount: 0,
        earned_amount: 4000,
      }),
      expect.objectContaining({
        kind: 'courier',
        subject_id: 'c1',
        status: 'paid',
        paid_amount: 5000,
        qualified_at: '2026-09-02T10:00:00.000Z',
      }),
      expect.objectContaining({
        kind: 'courier',
        subject_id: 'c3',
        status: 'paid',
        paid_amount: 5000,
      }),
    ]);
  });

  it('still pays when a premium row was already inserted', async () => {
    const insert = jest.fn(() => {
      throw new Error('duplicate key value violates unique constraint');
    });
    route(hasura, {
      ...base(),
      SumPortfolioAccruals: eligibleRows(),
      ...courierHandlers(),
      InsertPortfolioPremium: insert,
    });
    await expect(service.closePreviousMonth()).resolves.toBe(1);
    expect(insert).toHaveBeenCalled();
    expect(accounts.registerDepositIfNotExists).toHaveBeenCalledTimes(2);
  });

  it('stops before the deposit when a premium insert fails for another reason', async () => {
    route(hasura, {
      ...base(),
      SumPortfolioAccruals: eligibleRows(),
      ...courierHandlers(),
      InsertPortfolioPremium: () => {
        throw new Error('connection reset');
      },
    });
    await expect(service.closePreviousMonth()).rejects.toThrow('connection reset');
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
  });

  it('does not replace 1% when the currency has no grid', async () => {
    grids.loadFor.mockResolvedValue(null);
    await expect(
      service.replacesLegacy('CA', 'CAD', new Date('2026-11-02T00:00:00.000+01:00'))
    ).resolves.toBe(false);
  });

  it('replaces 1% when the flag is on and a grid exists', async () => {
    grids.loadFor.mockResolvedValue({ id: 'grid-xaf' });
    await expect(
      service.replacesLegacy('CM', 'XAF', new Date('2026-11-02T00:00:00.000+01:00'))
    ).resolves.toBe(true);
  });

  it('checks grid existence in order currency, not payout currency', async () => {
    grids.loadFor.mockImplementation(async (currency: string) => {
      return currency === 'XAF' ? { id: 'grid-xaf' } : null;
    });
    await expect(service.replacesLegacy('CA', 'CAD', new Date('2026-11-02T00:00:00.000Z'))).resolves.toBe(false);
    await expect(service.replacesLegacy('CA', 'XAF', new Date('2026-11-02T00:00:00.000Z'))).resolves.toBe(true);
  });

  function base() {
    return {
      AgentsInPortfolioPeriod: {
        representative_commission_accruals: [{ agent_id: 'agent-1', currency: 'XAF' }],
      },
      PremiumCloseCandidates: {},
      OpenPortfolioStatements: { representative_commission_statements: [] },
      LoadPortfolioStatement: () => ({
        representative_commission_statements: statement ? [statementRow()] : [],
      }),
      ZeroDeadAccruals: { update_representative_commission_accruals: { affected_rows: 0 } },
      SumPortfolioAccruals: { representative_commission_accruals: [] },
      StatementPortfolioAccruals: { representative_commission_accruals: [] },
      PortfolioRegistrations: { businesses_aggregate: { aggregate: { count: 0 } } },
      ActivationBusinesses: { agents_by_pk: { user_id: 'agent-user' }, businesses: [] },
      PaidPremiumSubjects: { representative_commission_premiums: [] },
      PremiumExists: { representative_commission_premiums: [] },
      AgentSignedAt: { agent_contracts: [] },
      ReferredCouriers: { agents: [] },
      PortfolioAgentAccount: () => ({
        agents_by_pk: { user: { accounts: accountId ? [{ id: accountId }] : [] } },
      }),
      PortfolioAgentUserId: { agents_by_pk: { user_id: 'agent-user' } },
      InsertPortfolioStatement: () => {
        statement = { id: 'stmt-1', status: 'open' };
        return { insert_representative_commission_statements_one: { id: 'stmt-1' } };
      },
      UpdatePortfolioStatement: { update_representative_commission_statements_by_pk: { id: 'stmt-1' } },
      InsertPortfolioHold: { insert_representative_commission_holds_one: { id: 'hold-1' } },
      AttachPortfolioAccruals: { update_representative_commission_accruals: { affected_rows: 1 } },
      CreditPortfolioStatement: () => {
        if (statement) statement = { id: statement.id, status: 'credited' };
        return { update_representative_commission_statements_by_pk: { id: 'stmt-1' } };
      },
      InsertPortfolioPremium: { insert_representative_commission_premiums_one: { id: 'prem-1' } },
      PortfolioHoldRelease: { representative_commission_holds: [] },
      DuePortfolioHolds: { representative_commission_holds: [] },
      ReleasePortfolioHold: { update_representative_commission_holds_by_pk: { id: 'hold-1' } },
    };
  }

  function statementRow() {
    return {
      id: statement?.id,
      status: statement?.status,
      period_start: '2026-09-01',
      gmv_total: 0,
      eligible_total: 0,
      registration_count: 0,
      objective_met: false,
      growth_percent: 0,
      base_amount: 0,
      growth_amount: 0,
      activation_paid: 0,
      fast_start_earned: 0,
      fast_start_paid: 0,
      quarterly_earned: 0,
      quarterly_paid: 0,
      payable_amount: 0,
      hold_amount: 0,
      recruitment_amount: 0,
    };
  }
});

describe('RepresentativeCommissionService hold release', () => {
  const hasura = { executeQuery: jest.fn() };
  const accounts = { registerDepositIfNotExists: jest.fn() };
  const service = new RepresentativeCommissionService(
    hasura as never,
    { getConfigurationByKey: jest.fn() } as never,
    { loadFor: jest.fn() } as never,
    accounts as never,
    { getUserCountryCode: jest.fn() } as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accounts.registerDepositIfNotExists.mockImplementation(async (input: { accountId: string }) => ({
      success: input.accountId !== 'acct-a2',
    }));
  });

  it('releases only the hold whose credit succeeded', async () => {
    route(hasura, {
      DuePortfolioHolds: {
        representative_commission_holds: [
          { id: 'h-missing', agent_id: 'a1', currency: 'XAF', remaining: 50 },
          { id: 'h-fail', agent_id: 'a2', currency: 'XAF', remaining: 80 },
          { id: 'h-ok', agent_id: 'a3', currency: 'XAF', remaining: '140' },
        ],
      },
      PortfolioAgentAccount: (vars: { agentId: string }) => ({
        agents_by_pk: {
          user: { accounts: vars.agentId === 'a1' ? [] : [{ id: `acct-${vars.agentId}` }] },
        },
      }),
      ReleasePortfolioHold: { update_representative_commission_holds_by_pk: { id: 'ok' } },
    });
    await expect(service.releaseDueHolds()).resolves.toBe(1);
    const released = named(hasura, 'ReleasePortfolioHold').map((call) => call[1].id);
    expect(released).toEqual(['h-ok']);
    expect(accounts.registerDepositIfNotExists).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct-a3', amount: 140 })
    );
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acct-a1' })
    );
  });

  it('marks a zero remaining hold released without moving money', async () => {
    route(hasura, {
      DuePortfolioHolds: {
        representative_commission_holds: [
          { id: 'h-zero', agent_id: 'a3', currency: 'XAF', remaining: null },
        ],
      },
      PortfolioAgentAccount: {
        agents_by_pk: { user: { accounts: [{ id: 'acct-a3' }] } },
      },
      ReleasePortfolioHold: { update_representative_commission_holds_by_pk: { id: 'h-zero' } },
    });
    await expect(service.releaseDueHolds()).resolves.toBe(1);
    expect(accounts.registerDepositIfNotExists).not.toHaveBeenCalled();
    expect(named(hasura, 'ReleasePortfolioHold')[0][1]).toEqual({ id: 'h-zero' });
  });
});

function grid(): StoredCommissionGrid {
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

function eligibleRows() {
  return {
    representative_commission_accruals: [
      { eligible_amount: '10000', gmv_amount: null, self_purchase: false },
      { eligible_amount: '99999', gmv_amount: '99999', self_purchase: true },
    ],
  };
}

function selfPurchaseRows() {
  return {
    representative_commission_accruals: [
      { eligible_amount: '99999', gmv_amount: '99999', self_purchase: true },
    ],
  };
}

function courierHandlers() {
  return {
    ActivationBusinesses: {
      agents_by_pk: { user_id: 'agent-user' },
      businesses: [
        {
          id: 'biz-act',
          merchant_agreement_accepted_at: '2026-09-02T10:00:00.000Z',
          orders: [
            {
              subtotal: 2500,
              completed_at: '2026-09-10T10:00:00.000Z',
              client: { user_id: 'buyer' },
            },
          ],
        },
      ],
    },
    ReferredCouriers: {
      agents: [courier('c1'), courier('c2'), courier('c3'), { id: 'c4', agent_contracts: [] }],
    },
    CourierDeliveries: (vars: { agentId: string }) => ({
      orders: [{ completed_at: COURIER_AT[vars.agentId] }],
    }),
    AmbassadorSignups: { businesses: [] },
  };
}

const COURIER_AT: Record<string, string> = {
  c1: '2026-09-02T10:00:00.000Z',
  c2: '2026-09-20T10:00:00.000Z',
  c3: '2026-09-05T10:00:00.000Z',
};

function courier(id: string) {
  return { id, agent_contracts: [{ signed_at: '2026-08-01T00:00:00.000Z' }] };
}

function route(hasura: { executeQuery: jest.Mock }, handlers: Record<string, unknown>) {
  hasura.executeQuery.mockImplementation(async (query: string, vars: unknown) => {
    const name = Object.keys(handlers).find((key) => query.includes(key));
    if (!name) throw new Error(`unexpected query ${query.slice(0, 70)}`);
    const handler = handlers[name];
    return typeof handler === 'function' ? (handler as (input: unknown) => unknown)(vars) : handler;
  });
}

function named(hasura: { executeQuery: jest.Mock }, token: string) {
  return hasura.executeQuery.mock.calls.filter((call) => String(call[0]).includes(token));
}

function insertedStatement(hasura: { executeQuery: jest.Mock }) {
  return named(hasura, 'InsertPortfolioStatement')[0][1].object;
}

function premiumObjects(hasura: { executeQuery: jest.Mock }) {
  return named(hasura, 'InsertPortfolioPremium').map((call) => call[1].object);
}
