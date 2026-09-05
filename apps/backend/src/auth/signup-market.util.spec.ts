import { isAfricanMarketCountry } from './signup-market.util';

describe('isAfricanMarketCountry', () => {
  it('returns true for supported African market codes', () => {
    expect(isAfricanMarketCountry('CM')).toBe(true);
    expect(isAfricanMarketCountry('ci')).toBe(true);
  });

  it('returns false for non-African or empty values', () => {
    expect(isAfricanMarketCountry('CA')).toBe(false);
    expect(isAfricanMarketCountry('')).toBe(false);
    expect(isAfricanMarketCountry(null)).toBe(false);
  });
});
