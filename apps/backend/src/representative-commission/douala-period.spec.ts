import { addDays, doualaMidnight } from './douala-period';
import { fastStartAmountDue } from './representative-commission-premiums';
import {
  portfolioCommissionApplies,
  PORTFOLIO_COMMISSION_CUTOVER,
  shouldReplaceLegacySalePay,
} from './portfolio-commission-flag';

describe('Douala commission periods', () => {
  it('starts a month at Africa/Douala midnight', () => {
    expect(doualaMidnight('2026-10-01').toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('puts a bonus that lands just after Douala midnight into that month', () => {
    const day90 = new Date('2026-09-30T23:30:00.000Z');
    const signedAt = addDays(day90, -89).toISOString();
    const october = { start: '2026-10-01', end: '2026-11-01' };
    const september = { start: '2026-09-01', end: '2026-10-01' };
    expect(fastStartAmountDue(signedAt, october)).toBe(true);
    expect(fastStartAmountDue(signedAt, september)).toBe(false);
  });
});

describe('portfolioCommissionApplies', () => {
  const previous = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previous;
  });

  it('uses the sale completion instant in production', () => {
    process.env.NODE_ENV = 'production';
    const cutover = Date.parse(PORTFOLIO_COMMISSION_CUTOVER);
    expect(portfolioCommissionApplies(true, new Date(cutover - 1))).toBe(false);
    expect(portfolioCommissionApplies(true, new Date(cutover))).toBe(true);
  });

  it('keeps 1% when the flag is off or the currency has no grid', () => {
    process.env.NODE_ENV = 'production';
    const after = new Date(Date.parse(PORTFOLIO_COMMISSION_CUTOVER));
    expect(shouldReplaceLegacySalePay(false, after, true)).toBe(false);
    expect(shouldReplaceLegacySalePay(true, after, false)).toBe(false);
    expect(shouldReplaceLegacySalePay(true, after, true)).toBe(true);
  });
});
