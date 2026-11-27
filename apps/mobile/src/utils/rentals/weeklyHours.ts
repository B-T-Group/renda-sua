import type { RentalWeeklyAvailabilityRow } from '../../types/rentals';

/** Display "HH:MM – HH:MM" for an open day, or null when closed / incomplete. */
export function formatDayHours(row: RentalWeeklyAvailabilityRow): string | null {
  if (!row.is_available || !row.start_time || !row.end_time) return null;
  return `${row.start_time.slice(0, 5)} – ${row.end_time.slice(0, 5)}`;
}

/** First open day (by weekday order) that has complete hours. */
export function firstOpenDay(
  rows: RentalWeeklyAvailabilityRow[]
): RentalWeeklyAvailabilityRow | undefined {
  return rows.find((row) => row.is_available && row.start_time && row.end_time);
}

/** Copy the source day's hours onto every other open day. */
export function applyHoursToOpenDays(
  rows: RentalWeeklyAvailabilityRow[],
  source: RentalWeeklyAvailabilityRow
): RentalWeeklyAvailabilityRow[] {
  return rows.map((row) =>
    row.is_available && row.weekday !== source.weekday
      ? { ...row, start_time: source.start_time, end_time: source.end_time }
      : row
  );
}
