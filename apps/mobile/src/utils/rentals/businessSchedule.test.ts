import { describe, expect, it } from 'vitest';
import type { BusinessRentalScheduleRow } from '../../types/rentals';
import {
  formatScheduleDateLine,
  groupScheduleRows,
  mergeScheduleRows,
  scheduleClientName,
  scheduleDurationParts,
} from './businessSchedule';

const NOW = new Date(2026, 10, 27, 9, 0).getTime();

function local(day: number, hour: number, minute = 0): string {
  return new Date(2026, 10, day, hour, minute).toISOString();
}

function row(id: string, startAt: string, endAt: string): BusinessRentalScheduleRow {
  return { id, status: 'active', start_at: startAt, end_at: endAt, total_amount: 40, currency: 'CAD' };
}

describe('groupScheduleRows', () => {
  it('splits into today, upcoming and past, in that order', () => {
    const sections = groupScheduleRows(
      [
        row('past', local(25, 8), local(25, 10)),
        row('later', local(30, 8), local(30, 10)),
        row('now', local(27, 8), local(27, 10)),
      ],
      NOW
    );
    expect(sections.map((s) => s.key)).toEqual(['today', 'upcoming', 'past']);
    expect(sections.map((s) => s.data[0].id)).toEqual(['now', 'later', 'past']);
  });

  it('keeps a multi-day booking that started earlier in today', () => {
    const [section] = groupScheduleRows([row('long', local(25, 8), local(28, 10))], NOW);
    expect(section.key).toBe('today');
  });

  it('omits empty sections and sorts by start', () => {
    const sections = groupScheduleRows(
      [row('b', local(30, 12), local(30, 14)), row('a', local(29, 12), local(29, 14))],
      NOW
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('mergeScheduleRows', () => {
  it('dedupes by id and sorts by start', () => {
    const merged = mergeScheduleRows([
      [row('b', local(30, 8), local(30, 9))],
      [row('a', local(28, 8), local(28, 9)), row('b', local(30, 8), local(30, 9))],
    ]);
    expect(merged.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('scheduleDurationParts', () => {
  it('breaks a window into days, hours and minutes', () => {
    expect(scheduleDurationParts(local(27, 8), local(27, 10))).toEqual({ days: 0, hours: 2, minutes: 0 });
    expect(scheduleDurationParts(local(27, 8), local(28, 10, 30))).toEqual({ days: 1, hours: 2, minutes: 30 });
  });

  it('returns zeros for invalid or reversed windows', () => {
    expect(scheduleDurationParts(local(27, 10), local(27, 8))).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(scheduleDurationParts('nope', 'nope')).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
});

describe('scheduleClientName', () => {
  it('joins first and last name and tolerates a missing client', () => {
    const named = {
      ...row('x', local(27, 8), local(27, 9)),
      rental_request: { id: 'r', created_at: '', client: { id: 'c', user: { first_name: 'MM', last_name: 'Test' } } },
    };
    expect(scheduleClientName(named)).toBe('MM Test');
    expect(scheduleClientName(row('y', local(27, 8), local(27, 9)))).toBe('');
  });
});

describe('formatScheduleDateLine', () => {
  it('shows one day for same-day bookings and a range across days', () => {
    expect(formatScheduleDateLine(local(27, 8), local(27, 10), 'en')).not.toContain('→');
    expect(formatScheduleDateLine(local(27, 8), local(29, 10), 'en')).toContain('→');
  });
});
