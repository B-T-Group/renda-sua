import type { RentalDateRange } from './rentalSearchDates';

/**
 * What "Rent" on a search card does.
 * - Dates picked: open the request screen with them.
 * - No dates and the day-and-hours picker on: open the request screen, which opens the new picker.
 * - No dates and the picker off: ask for dates in the search date sheet first (old flow).
 */
export function searchRentAction(
  dates: RentalDateRange | null,
  dayHoursPickerOn: boolean
): 'request' | 'search-dates' {
  if (dates || dayHoursPickerOn) return 'request';
  return 'search-dates';
}
