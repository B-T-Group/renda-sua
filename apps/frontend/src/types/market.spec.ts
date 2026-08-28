import {
  DEFAULT_MARKET_CODE,
  formatMarketCaption,
  MARKET_CAPTION_SEPARATOR,
  pickSupportedCountryCode,
} from './market';

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

describe('formatMarketCaption', () => {
  it('joins country and region with a UTF-8 middle dot', () => {
    expect(MARKET_CAPTION_SEPARATOR).toBe('\u00b7');
    expect(formatMarketCaption('Canada', 'Quebec')).toBe(
      `Canada ${MARKET_CAPTION_SEPARATOR} Quebec`
    );
    expect(formatMarketCaption('Canada', 'Quebec')).not.toContain('\uFFFD');
  });
});
