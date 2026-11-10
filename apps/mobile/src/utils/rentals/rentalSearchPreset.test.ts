import { localPickerInstantToRequestParts, requestedSlotUtcIso } from './rentalRequestUtc';
import {
  allDaySelectionsForRange,
  dailyTotalDiffersFromQuote,
  quoteRentalSelections,
  requestWindowIso,
  stayRequestState,
} from './rentalSearchPreset';

const openAllDay = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_available: true,
  start_time: '00:00:00',
  end_time: '23:59:00',
}));

describe('rental search preset', () => {
  it('prefills one all-day row per day from 12 Nov through 15 Nov', () => {
    const rows = allDaySelectionsForRange(
      { startDate: '2026-11-12', endDate: '2026-11-15', dayCount: 3 },
      [],
      25000
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.calendarDate)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
    expect(rows.every((row) => row.billing === 'all_day')).toBe(true);
  });

  it('keeps a 00:00–23:59 listing inside each UTC day instead of crossing midnight', () => {
    const rows = allDaySelectionsForRange(
      { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 },
      openAllDay,
      380
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.billing === 'all_day')).toBe(true);
    for (const row of rows) {
      const iso = requestWindowIso(row);
      expect(iso.start.slice(0, 10)).toBe(row.calendarDate);
      expect(iso.end.slice(0, 10)).toBe(row.calendarDate);
      expect(iso.end.endsWith('T00:00:00.000Z')).toBe(false);
      expect(iso.end).toBe(`${row.calendarDate}T23:59:00.000Z`);
      const parts = localPickerInstantToRequestParts(row.endMs);
      expect(requestedSlotUtcIso(parts.dateKey, parts.hour, parts.minute)).toBe(iso.end);
    }
    expect(quoteRentalSelections(rows, 16, 380)).toBe(760);
  });

  it('quotes an hourly window above the daily total', () => {
    const rows = allDaySelectionsForRange(
      { startDate: '2026-11-14', endDate: '2026-11-16', dayCount: 2 },
      openAllDay,
      0
    );
    expect(rows.every((row) => row.billing === 'hourly')).toBe(true);
    const quote = quoteRentalSelections(rows, 16, 380);
    expect(quote).toBe(768);
    expect(dailyTotalDiffersFromQuote(760, quote)).toBe(true);
    expect(dailyTotalDiffersFromQuote(760, 760)).toBe(false);
  });

  it('blocks a request when the edited dates are booked', () => {
    expect(stayRequestState(undefined)).toEqual({ status: 'open' });
    expect(stayRequestState({ available: true, nextAvailableDate: null, totalForDates: 800 })).toEqual({
      status: 'open',
    });
    expect(
      stayRequestState({ available: false, nextAvailableDate: '2026-11-16', totalForDates: null })
    ).toEqual({ status: 'blocked', nextAvailableDate: '2026-11-16' });
    expect(stayRequestState(null)).toEqual({ status: 'blocked', nextAvailableDate: null });
  });
});
