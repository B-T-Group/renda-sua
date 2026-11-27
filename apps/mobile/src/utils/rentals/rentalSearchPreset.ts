import type { SelectionRange, WeeklyRow } from './rentalRequestScheduleUtils';
import { listingDayBoundsLocal } from './rentalRequestScheduleUtils';
import { localPickerInstantToRequestParts, requestedSlotUtcIso } from './rentalRequestUtc';
import { eachDateKey, type RentalDateRange } from './rentalSearchDates';

function atLocalTime(isoDate: string, hours: number, minutes: number): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours, minutes, 0, 0);
}

function nextLocalMidnight(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, (day ?? 1) + 1, 0, 0, 0, 0);
}

/** Keep a same-day close from landing on the next midnight, which the server rejects. */
function closeBeforeMidnight(isoDate: string, close: Date): Date {
  const midnight = nextLocalMidnight(isoDate);
  if (close.getTime() < midnight.getTime()) return close;
  return new Date(midnight.getTime() - 60_000);
}

function clockOn(isoDate: string, clock: string): Date {
  const [hours, minutes] = clock.split(':').map(Number);
  return atLocalTime(isoDate, hours, minutes);
}

/**
 * One window per calendar day in [start, end). Each window stays inside that
 * day's listing hours and ends before the next midnight, because availability
 * is checked per UTC day and the day closes at 23:59. A daily price uses
 * all-day billing; otherwise the window is hourly. When the range has times, the
 * first day starts at the start time and the last day ends at the end time; those
 * partial days are hourly when the listing has an hourly price, else a day is billed.
 */
export function allDaySelectionsForRange(
  range: RentalDateRange,
  weekly: WeeklyRow[] = [],
  dailyPrice = 0,
  hourlyPrice = 0
): SelectionRange[] {
  const rows: SelectionRange[] = [];
  const keys = eachDateKey(range);
  keys.forEach((key, index) => {
    const [year, month, day] = key.split('-').map(Number);
    const noon = new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
    const bounds = listingDayBoundsLocal(noon, weekly);
    const startClock = index === 0 ? range.startTime : undefined;
    const endClock = index === keys.length - 1 ? range.endTime : undefined;
    const partial = Boolean(startClock || endClock) && hourlyPrice > 0;
    const open = partial && startClock ? clockOn(key, startClock) : bounds?.open ?? atLocalTime(key, 10, 0);
    const wanted = partial && endClock ? clockOn(key, endClock) : bounds?.close ?? atLocalTime(key, 18, 0);
    const close = closeBeforeMidnight(key, wanted);
    if (!(close > open)) return;
    const allDay = dailyPrice > 0 && !partial;
    rows.push({
      id: `search-${key}`,
      startMs: open.getTime(),
      endMs: close.getTime(),
      billing: allDay ? 'all_day' : 'hourly',
      ...(allDay ? { calendarDate: key } : {}),
    });
  });
  return rows;
}

/** ISO instants the request sheet sends. The server reads these as UTC. */
export function requestWindowIso(row: SelectionRange): { start: string; end: string } {
  const start = localPickerInstantToRequestParts(row.startMs);
  const end = localPickerInstantToRequestParts(row.endMs);
  return {
    start: requestedSlotUtcIso(start.dateKey, start.hour, start.minute),
    end: requestedSlotUtcIso(end.dateKey, end.hour, end.minute),
  };
}

/** Same formula as the rental request pricing snapshot. */
export function quoteRentalSelections(
  selections: Array<Pick<SelectionRange, 'startMs' | 'endMs' | 'billing' | 'calendarDate'>>,
  pricePerHour: number,
  pricePerDay: number,
  units = 1
): number {
  const qty = Math.max(1, Math.floor(units) || 1);
  let total = 0;
  for (const row of selections) {
    if (row.billing === 'all_day' && row.calendarDate) {
      total += Number((pricePerDay * qty).toFixed(2));
    } else {
      const hours = Math.max(1, Math.ceil((row.endMs - row.startMs) / 3_600_000));
      total += Number((pricePerHour * hours * qty).toFixed(2));
    }
  }
  return Number(total.toFixed(2));
}

export type StayHit = {
  available: boolean | null;
  nextAvailableDate: string | null;
  totalForDates: number | null;
};

/** Undefined means the dates have not been rechecked yet, so the request stays open. */
export function stayRequestState(
  hit: StayHit | null | undefined
): { status: 'open' } | { status: 'blocked'; nextAvailableDate: string | null } {
  if (hit === undefined) return { status: 'open' };
  if (hit === null || hit.available === false) {
    return { status: 'blocked', nextAvailableDate: hit?.nextAvailableDate ?? null };
  }
  return { status: 'open' };
}

export function dailyTotalDiffersFromQuote(
  dailyTotal: number | null,
  quote: number | null
): boolean {
  if (dailyTotal == null || quote == null) return false;
  return Number(dailyTotal.toFixed(2)) !== Number(quote.toFixed(2));
}
