import {
  isMobileMoneyCountry,
  pickMobileMoneyDefaultCountry,
} from './mobileMoneyCountry';

describe('isMobileMoneyCountry', () => {
  it('accepts Cameroon and Gabon only', () => {
    expect(isMobileMoneyCountry('cm')).toBe(true);
    expect(isMobileMoneyCountry('GA')).toBe(true);
    expect(isMobileMoneyCountry('CA')).toBe(false);
    expect(isMobileMoneyCountry(undefined)).toBe(false);
  });
});

describe('pickMobileMoneyDefaultCountry', () => {
  it('uses the item location when it is CM or GA', () => {
    expect(pickMobileMoneyDefaultCountry('cm')).toBe('CM');
    expect(pickMobileMoneyDefaultCountry('GA')).toBe('GA');
  });

  it('falls back to CM when the location is not a MoMo market', () => {
    expect(pickMobileMoneyDefaultCountry('CA')).toBe('CM');
    expect(pickMobileMoneyDefaultCountry(undefined)).toBe('CM');
  });
});
