import {
  BUSINESS_REFERRAL_10_ITEMS,
  LEGACY_ONBOARDING_FIRST_SALE,
  ONBOARDING_25_SMALL_SALE,
  ONBOARDING_X_FIRST_SALE,
  SALE_PERCENT,
  type CompensationAction,
  type CompensationRuleCode,
} from './compensation-rules';
import {
  PORTFOLIO_COMMISSION_CUTOVER,
  shouldReplaceLegacySalePay,
} from '../representative-commission/portfolio-commission-flag';
import { RepresentativeCompensationService } from './representative-compensation.service';

describe('portfolio replacement of the 1% sale pay', () => {
  const previousEnv = process.env.NODE_ENV;
  const configurations = { getConfigurationByKey: jest.fn() };
  const grids = { loadFor: jest.fn() };
  const commissions = { portfolioReplacesLegacy: jest.fn() };
  const service = new RepresentativeCompensationService(
    {} as never,
    {} as never,
    configurations as never,
    {} as never,
    {} as never,
    commissions as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
    configurations.getConfigurationByKey.mockImplementation(async (key: string, country?: string) => {
      if (key !== 'representative_portfolio_commission_enabled') return null;
      if (country === 'CM') return { boolean_value: true, status: 'active' };
      return null;
    });
    commissions.portfolioReplacesLegacy.mockImplementation(async (country: string, currency: string, at: Date) => {
      const hasFlag = await configurations.getConfigurationByKey('representative_portfolio_commission_enabled', country);
      const enabled = hasFlag?.boolean_value === true && hasFlag.status === 'active';
      const grid = await grids.loadFor(currency, at);
      return shouldReplaceLegacySalePay(enabled, at, !!grid);
    });
    grids.loadFor.mockResolvedValue({ id: 'grid-xaf' });
  });

  afterEach(() => {
    process.env.NODE_ENV = previousEnv;
    jest.useRealTimers();
  });

  it('keeps the 1% and the first-sale bonus when the flag is off', async () => {
    configurations.getConfigurationByKey.mockResolvedValue(null);
    const actual = await drop(service, actions(), '2026-12-01T00:00:00.000Z');
    expect(codes(actual)).toEqual(codes(actions()));
  });

  it('drops sale pay only from the production cutover, and keeps the other bonuses', async () => {
    const before = await drop(service, actions(), '2026-10-31T22:59:59.999Z');
    expect(codes(before)).toEqual(codes(actions()));
    const atCutover = await drop(service, actions(), '2026-10-31T23:00:00.000Z');
    expect(codes(atCutover)).toEqual([BUSINESS_REFERRAL_10_ITEMS, ONBOARDING_25_SMALL_SALE]);
    expect(Date.parse('2026-10-31T23:00:00.000Z')).toBe(Date.parse(PORTFOLIO_COMMISSION_CUTOVER));
  });

  it('drops the legacy first-sale code with the new one', async () => {
    const actual = await drop(service, actions(), '2026-11-02T00:00:00.000Z');
    expect(codes(actual)).not.toContain(LEGACY_ONBOARDING_FIRST_SALE);
    expect(codes(actual)).not.toContain(ONBOARDING_X_FIRST_SALE);
    expect(codes(actual)).not.toContain(SALE_PERCENT);
  });

  it('does not let an inactive country row fall through to an active global flag', async () => {
    configurations.getConfigurationByKey.mockImplementation(async (_key: string, country?: string) => {
      if (country === 'CM') return { boolean_value: true, status: 'inactive' };
      return { boolean_value: true, status: 'active' };
    });
    const actual = await drop(service, actions(), '2026-12-01T00:00:00.000Z');
    expect(codes(actual)).toContain(SALE_PERCENT);
  });

  it('uses the matching sale time, and the clock when that sale is missing', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T12:00:00.000Z'));
    const missing = await drop(service, [action(SALE_PERCENT, 'order-1')], null);
    expect(codes(missing)).toEqual([SALE_PERCENT]);
    const later = await (service as any).dropPortfolioReplaced([action(SALE_PERCENT, 'order-1')], {
      input: {
        completedSales: [{ id: 'order-1', completedAt: '2026-12-01T00:00:00.000Z' }],
      },
      eval: { countryCode: 'CM' },
    });
    expect(codes(later)).toEqual([]);
  });

  it('drops sale pay before the cutover outside production', async () => {
    process.env.NODE_ENV = 'test';
    const actual = await drop(service, [action(SALE_PERCENT, 'order-1')], '2026-10-01T00:00:00.000Z');
    expect(actual).toEqual([]);
  });
});

function drop(
  service: RepresentativeCompensationService,
  rows: CompensationAction[],
  completedAt: string | null
) {
  return (service as any).dropPortfolioReplaced(rows, {
    input: {
      completedSales: completedAt ? [{ id: 'order-1', completedAt }] : [],
    },
    eval: { countryCode: 'CM' },
  }) as Promise<CompensationAction[]>;
}

function actions(): CompensationAction[] {
  return [
    action(SALE_PERCENT, 'order-1'),
    action(ONBOARDING_X_FIRST_SALE, 'order-1'),
    action(LEGACY_ONBOARDING_FIRST_SALE, 'order-1'),
    action(BUSINESS_REFERRAL_10_ITEMS, null),
    action(ONBOARDING_25_SMALL_SALE, 'order-1'),
  ];
}

function action(ruleCode: CompensationRuleCode, orderId: string | null): CompensationAction {
  return { ruleCode, amount: 100, grossMilestoneAmount: null, orderId, saleAmount: 1000 };
}

function codes(rows: CompensationAction[]) {
  return rows.map((row) => row.ruleCode);
}
