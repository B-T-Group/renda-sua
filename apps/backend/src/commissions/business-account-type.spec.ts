import {
  ACCOUNT_TYPE_LOCK_DAYS,
  BusinessAccountType,
  getAccountTypePlansForCountry,
  getCommissionForBusinessAccountType,
  getCommissionMapForCountry,
} from './business-account-type';

describe('getCommissionForBusinessAccountType', () => {
  it('returns default CA commissions for each account tier', () => {
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD)
    ).toBe(12);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.PREMIUM)
    ).toBe(15);
    expect(getCommissionForBusinessAccountType(BusinessAccountType.ELITE)).toBe(
      20
    );
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD, 'CA')
    ).toBe(12);
  });

  it('returns African CFA market commissions for each account tier', () => {
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD, 'CM')
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.PREMIUM, 'CM')
    ).toBe(12);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.ELITE, 'GA')
    ).toBe(15);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD, 'Cameroon')
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD, 'TG')
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.PREMIUM, 'BJ')
    ).toBe(12);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.ELITE, 'CI')
    ).toBe(15);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD, 'CG')
    ).toBe(7);
  });

  it('maps CFA country names to African commission rates', () => {
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.STANDARD, 'Togo')
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.PREMIUM, ' Benin ')
    ).toBe(12);
    expect(
      getCommissionForBusinessAccountType(
        BusinessAccountType.ELITE,
        "Cote d'Ivoire"
      )
    ).toBe(15);
    expect(
      getCommissionForBusinessAccountType(
        BusinessAccountType.STANDARD,
        "Cote d'Ivoire (Ivory Coast)"
      )
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(
        BusinessAccountType.PREMIUM,
        'Ivory Coast'
      )
    ).toBe(12);
    expect(
      getCommissionForBusinessAccountType(
        BusinessAccountType.STANDARD,
        'Republic of the Congo'
      )
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(
        BusinessAccountType.STANDARD,
        'Congo-Brazzaville'
      )
    ).toBe(7);
    expect(
      getCommissionForBusinessAccountType(BusinessAccountType.ELITE, 'Congo')
    ).toBe(15);
  });

  it('falls back to STANDARD commission for missing or unknown types', () => {
    expect(getCommissionForBusinessAccountType(undefined)).toBe(12);
    expect(getCommissionForBusinessAccountType(null)).toBe(12);
    expect(getCommissionForBusinessAccountType('GOLD')).toBe(12);
    expect(getCommissionForBusinessAccountType(undefined, 'CM')).toBe(7);
  });

  it('exposes plans for a country', () => {
    expect(getAccountTypePlansForCountry('CM')).toEqual([
      { id: 'STANDARD', commissionPercent: 7 },
      { id: 'PREMIUM', commissionPercent: 12 },
      { id: 'ELITE', commissionPercent: 15 },
    ]);
    expect(getCommissionMapForCountry(null).STANDARD).toBe(12);
  });

  it('exposes a 30-day plan lock window', () => {
    expect(ACCOUNT_TYPE_LOCK_DAYS).toBe(30);
  });
});
