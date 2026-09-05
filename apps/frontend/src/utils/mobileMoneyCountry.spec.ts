import { pickMobileMoneyDefaultCountry } from './mobileMoneyCountry';

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
