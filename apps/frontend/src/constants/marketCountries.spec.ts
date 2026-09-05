import {
  AFRICAN_MARKET_COUNTRY_CODES,
  isAfricanMarketCountry,
  isSignupCountryCode,
} from './marketCountries';

describe('isAfricanMarketCountry', () => {
  it('includes the new CFA markets used for postal-optional UX', () => {
    expect(AFRICAN_MARKET_COUNTRY_CODES).toEqual([
      'CM',
      'GA',
      'TG',
      'BJ',
      'CI',
      'CG',
    ]);
    expect(isAfricanMarketCountry(' tg ')).toBe(true);
    expect(isAfricanMarketCountry('bj')).toBe(true);
    expect(isAfricanMarketCountry('CI')).toBe(true);
    expect(isAfricanMarketCountry('CG')).toBe(true);
  });

  it('excludes Stripe rails and blank codes', () => {
    expect(isAfricanMarketCountry('CA')).toBe(false);
    expect(isAfricanMarketCountry('US')).toBe(false);
    expect(isAfricanMarketCountry('FR')).toBe(false);
    expect(isAfricanMarketCountry('')).toBe(false);
    expect(isAfricanMarketCountry(null)).toBe(false);
  });
});

describe('isSignupCountryCode', () => {
  it('allows African CFA markets plus US and CA', () => {
    expect(isSignupCountryCode('TG')).toBe(true);
    expect(isSignupCountryCode('BJ')).toBe(true);
    expect(isSignupCountryCode('CI')).toBe(true);
    expect(isSignupCountryCode('CG')).toBe(true);
    expect(isSignupCountryCode(' us ')).toBe(true);
    expect(isSignupCountryCode('CA')).toBe(true);
    expect(isSignupCountryCode('FR')).toBe(false);
    expect(isSignupCountryCode(undefined)).toBe(false);
  });
});
