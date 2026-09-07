import type { RentalWeeklyAvailabilityRow } from '../../types/rentals';

/** Align with backend/web defaults: Sun closed; Mon–Sat 08:00–20:00. */
export function defaultWeeklyAvailability(): RentalWeeklyAvailabilityRow[] {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const isOpen = weekday >= 1 && weekday <= 6;
    return {
      weekday,
      is_available: isOpen,
      start_time: isOpen ? '08:00:00' : null,
      end_time: isOpen ? '20:00:00' : null,
    };
  });
}
