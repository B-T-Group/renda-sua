import { parseSearchDateRange } from './rental-search.dates';

describe('parseSearchDateRange', () => {
  it('accepts a 1 to 30 day range', () => {
    expect(parseSearchDateRange('2026-11-20', '2026-11-21')?.dayCount).toBe(1);
    expect(parseSearchDateRange('2026-11-20', '2026-12-20')?.dayCount).toBe(30);
  });

  it('returns null when both dates are missing', () => {
    expect(parseSearchDateRange()).toBeNull();
  });

  it.each([
    ['2026-11-20', undefined],
    ['2026-11-20', '2026-11-20'],
    ['2026-11-21', '2026-11-20'],
    ['2026-11-20', '2026-12-21'],
    ['2026-13-01', '2026-13-03'],
    ['2026-02-29', '2026-03-02'],
    ['2026-11-31', '2026-12-02'],
  ])('rejects %s .. %s', (start, end) => {
    expect(() => parseSearchDateRange(start, end)).toThrow('INVALID_DATE_RANGE');
  });
});
