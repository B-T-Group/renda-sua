import type { SelectionRange, WeeklyRow } from './rentalRequestScheduleUtils';
import { listingDayBoundsLocal } from './rentalRequestScheduleUtils';
import { eachDateKey, type RentalDateRange } from './rentalSearchDates';

function atLocalTime(isoDate: string, hours: number, minutes: number): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours, minutes, 0, 0);
}

/** One all-day selection per calendar day in [start, end). The request sheet prices these at the daily rate. */
export function allDaySelectionsForRange(
  range: RentalDateRange,
  weekly: WeeklyRow[] = []
): SelectionRange[] {
  return eachDateKey(range).map((key) => {
    const [year, month, day] = key.split('-').map(Number);
    const noon = new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
    const bounds = listingDayBoundsLocal(noon, weekly);
    const open = bounds?.open ?? atLocalTime(key, 10, 0);
    const close = bounds?.close ?? atLocalTime(key, 18, 0);
    return {
      id: `search-${key}`,
      startMs: open.getTime(),
      endMs: close.getTime(),
      billing: 'all_day' as const,
      calendarDate: key,
    };
  });
}
