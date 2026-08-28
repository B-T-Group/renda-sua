import { DEFAULT_MARKET_CODE, pickSupportedCountryCode } from './market';

describe('pickSupportedCountryCode', () => {
  it('prefers a supported preferred code', () => {
    expect(pickSupportedCountryCode('ca', ['CM', 'CA', 'US'])).toBe('CA');
  });

  it('falls back to the default when preferred is unsupported', () => {
    expect(pickSupportedCountryCode('ZZ', ['CM', 'CA'])).toBe(DEFAULT_MARKET_CODE);
  });

  it('uses the first supported ISO when default is missing', () => {
    expect(pickSupportedCountryCode(null, ['GA'])).toBe('GA');
  });
});
