import {
  PORTFOLIO_COMMISSION_CUTOVER,
  PORTFOLIO_COMMISSION_FLAG,
  portfolioCommissionApplies,
  readPortfolioEnabled,
} from './portfolio-commission-flag';

describe('readPortfolioEnabled', () => {
  const active = { boolean_value: true, status: 'active' };

  it('lets an explicit country row win over the global flag', async () => {
    const read = jest.fn(async (_key: string, country?: string) => {
      if (country === 'CM') return { boolean_value: false, status: 'active' };
      return active;
    });
    await expect(readPortfolioEnabled(read, 'CM')).resolves.toBe(false);
    expect(read).toHaveBeenCalledWith(PORTFOLIO_COMMISSION_FLAG, 'CM');
    expect(read).not.toHaveBeenCalledWith(PORTFOLIO_COMMISSION_FLAG, undefined);
  });

  it('uses the global flag when the country row is missing or the read throws', async () => {
    const missing = jest.fn(async (_key: string, country?: string) =>
      country ? null : active
    );
    await expect(readPortfolioEnabled(missing, 'GA')).resolves.toBe(true);
    const thrown = jest.fn(async (_key: string, country?: string) => {
      if (country) throw new Error('no country row');
      return active;
    });
    await expect(readPortfolioEnabled(thrown, 'CM')).resolves.toBe(true);
  });

  it('stays off unless the chosen row is an active boolean true', async () => {
    const inactive = jest.fn(async () => ({ boolean_value: true, status: 'inactive' }));
    const off = jest.fn(async () => ({ boolean_value: false, status: 'active' }));
    const bothThrow = jest.fn(async () => {
      throw new Error('config down');
    });
    await expect(readPortfolioEnabled(inactive, null)).resolves.toBe(false);
    await expect(readPortfolioEnabled(off, null)).resolves.toBe(false);
    await expect(readPortfolioEnabled(bothThrow, 'CM')).resolves.toBe(false);
  });
});

describe('portfolioCommissionApplies outside production', () => {
  const previous = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previous;
  });

  it('follows the flag immediately when the process is not production', () => {
    process.env.NODE_ENV = 'test';
    const before = new Date(Date.parse(PORTFOLIO_COMMISSION_CUTOVER) - 1);
    expect(portfolioCommissionApplies(false, before)).toBe(false);
    expect(portfolioCommissionApplies(true, before)).toBe(true);
  });
});
