import { peakConcurrentUnits, unitsStillFree, weekdaysOpen, nextFreeStartMs, isHeldBooking } from './rental-capacity';
import { availabilityForListing, parseSearchDateRange, totalForDates } from './rental-search.dates';

describe('rental capacity', () => {
  const day = 86_400_000;
  const start = Date.UTC(2026, 10, 12);

  it('counts the peak of overlapping units and ignores ranges that only touch', () => {
    const peak = peakConcurrentUnits(
      [
        { startMs: start, endMs: start + day, units: 1 },
        { startMs: start, endMs: start + day, units: 1 },
        { startMs: start + day, endMs: start + 2 * day, units: 1 },
      ],
      start,
      start + 2 * day
    );
    expect(peak).toBe(2);
  });

  it('treats a full hold as not free and the next open day as free', () => {
    const windows = [{ startMs: start, endMs: start + 3 * day, units: 1 }];
    expect(unitsStillFree(1, windows, start, start + 3 * day)).toBe(false);
    expect(unitsStillFree(1, windows, start + 3 * day, start + 6 * day)).toBe(true);
  });

  it('keeps proposed holds only until the contract expires', () => {
    expect(isHeldBooking('proposed', new Date(start + day).toISOString(), start)).toBe(true);
    expect(isHeldBooking('proposed', new Date(start).toISOString(), start + day)).toBe(false);
    expect(isHeldBooking('cancelled', null, start)).toBe(false);
    expect(isHeldBooking('reserved', null, start)).toBe(true);
  });

  it('skips a closed weekday when looking for the next free start', () => {
    const weekly = [
      { weekday: 0, is_available: false },
      { weekday: 1, is_available: true },
      { weekday: 2, is_available: true },
      { weekday: 3, is_available: true },
      { weekday: 4, is_available: true },
      { weekday: 5, is_available: true },
      { weekday: 6, is_available: true },
    ];
    const sunday = Date.UTC(2026, 10, 15);
    expect(new Date(sunday).getUTCDay()).toBe(0);
    expect(weekdaysOpen(weekly, sunday, sunday + day)).toBe(false);
    const next = nextFreeStartMs({
      unitsAvailable: 1,
      windows: [],
      weekly,
      startMs: sunday,
      endMs: sunday + day,
      nowMs: sunday,
    });
    expect(next).toBe(sunday + day);
  });
});

describe('dated rental search totals', () => {
  it('prices 12 Nov through 15 Nov as three days and hides the total when booked', () => {
    const range = parseSearchDateRange('2026-11-12', '2026-11-15');
    if (!range) throw new Error('expected a date range');
    expect(range?.dayCount).toBe(3);
    expect(totalForDates(25000, 3)).toBe(75000);
    const booked = availabilityForListing({
      unitsAvailable: 1,
      windows: [{ startMs: range.startMs, endMs: range.endMs, units: 1 }],
      range,
      nowMs: Date.UTC(2026, 10, 10),
      pricePerDay: 25000,
    });
    expect(booked.available).toBe(false);
    expect(booked.totalForDates).toBeNull();
    expect(booked.nextAvailableDate).toBe('2026-11-15');
  });

  it('rejects a reversed or same-day exclusive range', () => {
    expect(() => parseSearchDateRange('2026-11-15', '2026-11-12')).toThrow('INVALID_DATE_RANGE');
    expect(() => parseSearchDateRange('2026-11-12', '2026-11-12')).toThrow('INVALID_DATE_RANGE');
  });
});
