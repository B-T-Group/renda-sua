import { describe, expect, it } from 'vitest';
import type { RentalWeeklyAvailabilityRow } from '../../types/rentals';
import { applyHoursToOpenDays, firstOpenDay, formatDayHours } from './weeklyHours';

const row = (
  weekday: number,
  is_available: boolean,
  start_time: string | null,
  end_time: string | null
): RentalWeeklyAvailabilityRow => ({ weekday, is_available, start_time, end_time });

describe('weeklyHours', () => {
  const rows = [
    row(0, false, null, null),
    row(1, true, '09:00:00', '17:00:00'),
    row(2, true, '08:00:00', '20:00:00'),
  ];

  it('formats open days and hides closed ones', () => {
    expect(formatDayHours(rows[1])).toBe('09:00 – 17:00');
    expect(formatDayHours(rows[0])).toBeNull();
  });

  it('finds the first open day', () => {
    expect(firstOpenDay(rows)?.weekday).toBe(1);
  });

  it('copies hours to other open days only', () => {
    const next = applyHoursToOpenDays(rows, rows[1]);
    expect(next[0]).toEqual(rows[0]);
    expect(next[2].start_time).toBe('09:00:00');
    expect(next[2].end_time).toBe('17:00:00');
  });
});
