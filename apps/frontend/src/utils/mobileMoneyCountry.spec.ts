import {
  isMobileMoneyCountry,
  mobileMoneyCallingCode,
  pickMobileMoneyDefaultCountry,
} from './mobileMoneyCountry';

describe('isMobileMoneyCountry', () => {
  it('accepts Cameroon, Gabon, and Togo', () => {
    expect(isMobileMoneyCountry('cm')).toBe(true);
    expect(isMobileMoneyCountry('GA')).toBe(true);
    expect(isMobileMoneyCountry('tg')).toBe(true);
    expect(isMobileMoneyCountry('  TG ')).toBe(true);
    expect(isMobileMoneyCountry('CA')).toBe(false);
    expect(isMobileMoneyCountry('')).toBe(false);
    expect(isMobileMoneyCountry(null)).toBe(false);
    expect(isMobileMoneyCountry(undefined)).toBe(false);
  });
});

describe('pickMobileMoneyDefaultCountry', () => {
  it('uses the item location when it is a MoMo market', () => {
    expect(pickMobileMoneyDefaultCountry('cm')).toBe('CM');
    expect(pickMobileMoneyDefaultCountry('GA')).toBe('GA');
    expect(pickMobileMoneyDefaultCountry('TG')).toBe('TG');
  });

  it('falls back to CM when the location is not a MoMo market', () => {
    expect(pickMobileMoneyDefaultCountry('CA')).toBe('CM');
    expect(pickMobileMoneyDefaultCountry(undefined)).toBe('CM');
  });

  it('clamps to an allowed subset (XAF-only pickers)', () => {
    expect(pickMobileMoneyDefaultCountry('TG', ['CM', 'GA'])).toBe('CM');
    expect(pickMobileMoneyDefaultCountry('GA', ['CM', 'GA'])).toBe('GA');
  });
});

describe('mobileMoneyCallingCode', () => {
  it('maps ISO codes to calling codes', () => {
    expect(mobileMoneyCallingCode('TG')).toBe('228');
    expect(mobileMoneyCallingCode('cm')).toBe('237');
    expect(mobileMoneyCallingCode('CA')).toBeNull();
  });
});
