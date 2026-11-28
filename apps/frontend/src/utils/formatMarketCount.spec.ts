import { formatMarketCount, formatMarketCountExact } from './formatMarketCount';

describe('formatMarketCount', () => {
  it('is exact with separators below 10,000', () => {
    expect(formatMarketCount(0, 'en')).toBe('0');
    expect(formatMarketCount(86, 'en')).toBe('86');
    expect(formatMarketCount(1240, 'en')).toBe('1,240');
    expect(formatMarketCount(9999, 'en')).toBe('9,999');
  });

  it('uses a narrow no-break space for FR thousands', () => {
    expect(formatMarketCount(1240, 'fr')).toBe('1\u202f240');
    expect(formatMarketCount(1240, 'fr-CA')).toBe('1\u202f240');
    expect(formatMarketCount(999, 'fr')).toBe('999');
  });

  it('goes compact from 10,000', () => {
    expect(formatMarketCount(10000, 'en')).toBe('10k');
    expect(formatMarketCount(12400, 'en')).toBe('12.4k');
    expect(formatMarketCount(12449, 'en')).toBe('12.4k');
    expect(formatMarketCount(99950, 'en')).toBe('99.9k');
    expect(formatMarketCount(12400, 'fr')).toBe('12,4\u00a0k');
    expect(formatMarketCount(10000, 'fr')).toBe('10\u00a0k');
    expect(formatMarketCount(1_250_000, 'en')).toBe('1.2M');
  });

  it('treats bad input as 0', () => {
    expect(formatMarketCount(Number.NaN, 'en')).toBe('0');
    expect(formatMarketCount(-5, 'en')).toBe('0');
  });

  it('keeps the exact figure for accessibility labels', () => {
    expect(formatMarketCountExact(12400, 'en')).toBe('12,400');
    expect(formatMarketCountExact(12400, 'fr')).toBe('12\u202f400');
  });
});
