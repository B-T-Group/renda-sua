import {
  ACCOUNT_TYPE_LOCK_DAYS,
  BusinessAccountType,
  getCommissionForBusinessAccountType,
} from './business-account-type';

describe('getCommissionForBusinessAccountType', () => {
  it('returns the configured commission for each account tier', () => {
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD)
    ).toBe(12);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.PREMIUM)
    ).toBe(15);
    expect(getCommissionForBusinessAccountType(BusinessAccountType.ELITE)).toBe(
      20
    );
  });

  it('falls back to STANDARD commission for missing or unknown types', () => {
    expect(getCommissionForBusinessAccountType(undefined)).toBe(12);
    expect(getCommissionForBusinessAccountType(null)).toBe(12);
    expect(getCommissionForBusinessAccountType('GOLD')).toBe(12);
  });

  it('exposes a 30-day plan lock window', () => {
    expect(ACCOUNT_TYPE_LOCK_DAYS).toBe(30);
  });
});
