import type { FoodAvailability } from '../types/food';
import {
  formatNextOpening,
  formatSlotRange,
  formatSlotTime,
  groupFoodSlotsByDay,
  isMarkedUnavailableToday,
  isOvernightSlot,
  resolveFoodAvailabilityStatus,
  sortFoodSlots,
} from './foodAvailability';

function availability(
  overrides: Partial<FoodAvailability> = {}
): FoodAvailability {
  return {
    has_schedule: true,
    is_open_now: true,
    is_marked_unavailable_today: false,
    is_available_now: true,
    next_opening_at: null,
    timezone: 'Africa/Douala',
    slots: [],
    ...overrides,
  };
}

describe('resolveFoodAvailabilityStatus', () => {
  it('returns null for rows that are not cooked food', () => {
    expect(resolveFoodAvailabilityStatus(null)).toBeNull();
    expect(resolveFoodAvailabilityStatus(undefined)).toBeNull();
  });

  it('reports available while a window is open', () => {
    expect(resolveFoodAvailabilityStatus(availability())).toBe('available');
  });

  it('reports sold out even while the window is open', () => {
    const actual = resolveFoodAvailabilityStatus(
      availability({ is_marked_unavailable_today: true, is_available_now: false })
    );

    expect(actual).toBe('sold_out');
  });

  it('reports closed outside the window', () => {
    const actual = resolveFoodAvailabilityStatus(
      availability({ is_open_now: false, is_available_now: false })
    );

    expect(actual).toBe('closed');
  });
});

describe('isMarkedUnavailableToday', () => {
  it('is false when the dish was never marked sold out', () => {
    expect(isMarkedUnavailableToday(null)).toBe(false);
    expect(isMarkedUnavailableToday(undefined)).toBe(false);
  });

  it('is true for a stamp from earlier today', () => {
    const earlierToday = new Date();
    earlierToday.setHours(1, 0, 0, 0);

    expect(isMarkedUnavailableToday(earlierToday.toISOString())).toBe(true);
  });

  it('is false for a stamp from yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    expect(isMarkedUnavailableToday(yesterday.toISOString())).toBe(false);
  });

  it('is false for an unparseable stamp', () => {
    expect(isMarkedUnavailableToday('not-a-date')).toBe(false);
  });
});

describe('formatSlotTime', () => {
  it('drops seconds from Postgres time values', () => {
    expect(formatSlotTime('12:30:00')).toBe('12:30');
  });

  it('pads a single-digit hour', () => {
    expect(formatSlotTime('9:05')).toBe('09:05');
  });

  it('passes through values it cannot parse', () => {
    expect(formatSlotTime('nonsense')).toBe('nonsense');
  });
});

describe('formatSlotRange', () => {
  it('renders a readable window', () => {
    expect(
      formatSlotRange({
        day_of_week: 1,
        start_time: '12:30:00',
        end_time: '16:00:00',
      })
    ).toBe('12:30 - 16:00');
  });
});

describe('isOvernightSlot', () => {
  it('detects a window running past midnight', () => {
    expect(
      isOvernightSlot({
        day_of_week: 5,
        start_time: '20:00:00',
        end_time: '02:00:00',
      })
    ).toBe(true);
  });

  it('treats a same-day window as normal', () => {
    expect(
      isOvernightSlot({
        day_of_week: 1,
        start_time: '12:30:00',
        end_time: '16:00:00',
      })
    ).toBe(false);
  });
});

describe('sortFoodSlots', () => {
  it('orders by day then start time without mutating the input', () => {
    const input = [
      { day_of_week: 3, start_time: '10:00:00', end_time: '12:00:00' },
      { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
      { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
    ];

    const actual = sortFoodSlots(input);

    expect(actual.map((s) => [s.day_of_week, s.start_time])).toEqual([
      [1, '12:30:00'],
      [1, '18:00:00'],
      [3, '10:00:00'],
    ]);
    expect(input[0].day_of_week).toBe(3);
  });
});

describe('groupFoodSlotsByDay', () => {
  it('groups windows under each weekday', () => {
    const actual = groupFoodSlotsByDay([
      { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
      { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
      { day_of_week: 5, start_time: '20:00:00', end_time: '02:00:00' },
    ]);

    expect([...actual.keys()]).toEqual([1, 5]);
    expect(actual.get(1)).toHaveLength(2);
    expect(actual.get(1)?.[0].start_time).toBe('12:30:00');
  });
});

describe('formatNextOpening', () => {
  it('renders the weekday and time in the restaurant timezone', () => {
    // 11:30 UTC is 12:30 in Douala on Monday 24 August 2026.
    const actual = formatNextOpening(
      '2026-08-24T11:30:00.000Z',
      'Africa/Douala',
      'en-GB'
    );

    expect(actual).toContain('Monday');
    expect(actual).toContain('12:30');
  });

  it('returns null when there is no upcoming window', () => {
    expect(formatNextOpening(null, 'Africa/Douala', 'en-GB')).toBeNull();
  });

  it('returns null for an unparseable timestamp', () => {
    expect(formatNextOpening('not-a-date', 'Africa/Douala', 'en-GB')).toBeNull();
  });

  it('falls back gracefully on an invalid timezone', () => {
    expect(
      formatNextOpening('2026-08-24T11:30:00.000Z', 'Not/AZone', 'en-GB')
    ).toBeNull();
  });
});
