import { weekdaysOpen } from './rental-capacity';
import { availabilityForListing, parseSearchDateRange } from './rental-search.dates';

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
    ['2026-11-20', '2026-04-31'],
    [' 2026-11-20', '2026-11-21'],
  ])('rejects %s .. %s', (start, end) => {
    expect(() => parseSearchDateRange(start, end)).toThrow('INVALID_DATE_RANGE');
  });

  it('keeps a real leap day and does not roll 29 Feb onto 1 Mar', () => {
    expect(parseSearchDateRange('2024-02-28', '2024-03-01')?.dayCount).toBe(2);
    expect(parseSearchDateRange('2024-02-29', '2024-03-01')?.dayCount).toBe(1);
  });

  describe('clock times', () => {
    const hour = 3_600_000;

    it('puts the start time on the first day and the end time on the last day', () => {
      const range = parseSearchDateRange('2026-11-28', '2026-11-30', '09:00', '18:00');
      expect(range?.dayCount).toBe(2);
      expect(range?.startMs).toBe(Date.UTC(2026, 10, 28, 9));
      expect(range?.endMs).toBe(Date.UTC(2026, 10, 29, 18));
    });

    it('reads 24:00 as the end of the last day and missing times as whole days', () => {
      expect(parseSearchDateRange('2026-11-28', '2026-11-29', '10:00', '24:00')?.endMs).toBe(Date.UTC(2026, 10, 29));
      const whole = parseSearchDateRange('2026-11-28', '2026-11-30');
      expect(whole?.startMs).toBe(Date.UTC(2026, 10, 28));
      expect(whole?.endMs).toBe(Date.UTC(2026, 10, 30));
    });

    it.each([
      ['10:00', '10:00'],
      ['12:00', '09:00'],
      ['24:00', '24:00'],
      ['9am', '18:00'],
    ])('rejects a one-day window %s .. %s', (from, to) => {
      expect(() => parseSearchDateRange('2026-11-28', '2026-11-29', from, to)).toThrow('INVALID_DATE_RANGE');
    });

    it('is free in the gap an earlier booking leaves and busy when the hours overlap', () => {
      const booked = [{ startMs: Date.UTC(2026, 10, 28, 8), endMs: Date.UTC(2026, 10, 28, 12), units: 1 }];
      const base = { unitsAvailable: 1, windows: booked, nowMs: Date.UTC(2026, 10, 1), pricePerDay: 10 };
      const after = parseSearchDateRange('2026-11-28', '2026-11-29', '12:00', '18:00')!;
      const during = parseSearchDateRange('2026-11-28', '2026-11-29', '11:00', '18:00')!;
      expect(availabilityForListing({ ...base, range: after }).available).toBe(true);
      expect(availabilityForListing({ ...base, range: during }).available).toBe(false);
      expect(availabilityForListing({ ...base, range: parseSearchDateRange('2026-11-28', '2026-11-29')! }).available).toBe(false);
    });

    it('checks the last weekday even when the range ends before the start clock time', () => {
      const closedSaturday = [{ weekday: 6, is_available: false }];
      const range = parseSearchDateRange('2026-11-27', '2026-11-29', '10:00', '09:00')!;
      expect(range.endMs - range.startMs).toBe(23 * hour);
      expect(weekdaysOpen(closedSaturday, range.startMs, range.endMs)).toBe(false);
    });
  });
});
