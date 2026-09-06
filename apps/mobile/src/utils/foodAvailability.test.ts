import { describe, expect, it } from 'vitest';
import type { FoodAvailability } from '../types/food';
import {
  FOOD_CATEGORY_NAME,
  FOOD_SUB_CATEGORY_NAME,
  formatNextOpening,
  formatSlotRange,
  formatSlotTime,
  foodWeekdayName,
  groupFoodSlotsByDay,
  filterFoodCatalogItems,
  isFoodCatalogItem,
  isFoodCategoryName,
  isFoodOrderBlocked,
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

describe('isFoodCategoryName', () => {
  it('exports Local Dishes as the default cooked-food subcategory', () => {
    expect(FOOD_SUB_CATEGORY_NAME).toBe('Local Dishes');
  });

  it('matches the cooked-food category', () => {
    expect(isFoodCategoryName(FOOD_CATEGORY_NAME)).toBe(true);
  });

  it('does not match the grocery category', () => {
    expect(isFoodCategoryName('Food & Beverages')).toBe(false);
  });

  it('handles missing values', () => {
    expect(isFoodCategoryName(null)).toBe(false);
    expect(isFoodCategoryName(undefined)).toBe(false);
  });
});

describe('isFoodCatalogItem', () => {
  it('keeps cooked-food rows and drops grocery and marketplace rows', () => {
    const dish = {
      item: { item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } } },
    };
    const grocery = {
      item: { item_sub_category: { item_category: { name: 'Food & Beverages' } } },
    };
    const kettle = {
      item: { item_sub_category: { item_category: { name: 'Électroménager' } } },
    };
    expect(isFoodCatalogItem(dish)).toBe(true);
    expect(isFoodCatalogItem(grocery)).toBe(false);
    expect(filterFoodCatalogItems([dish, grocery, kettle])).toEqual([dish]);
  });
});

describe('resolveFoodAvailabilityStatus', () => {
  it('returns null for rows that are not cooked food', () => {
    expect(resolveFoodAvailabilityStatus(null)).toBeNull();
  });

  it('reports available while a window is open', () => {
    expect(resolveFoodAvailabilityStatus(availability())).toBe('available');
  });

  it('reports sold out even while the window is open', () => {
    expect(
      resolveFoodAvailabilityStatus(
        availability({ is_marked_unavailable_today: true, is_available_now: false })
      )
    ).toBe('sold_out');
  });

  it('reports closed outside the window', () => {
    expect(
      resolveFoodAvailabilityStatus(
        availability({ is_open_now: false, is_available_now: false })
      )
    ).toBe('closed');
  });
});

describe('isMarkedUnavailableToday', () => {
  const fridayNight = {
    day_of_week: 5,
    start_time: '20:00:00',
    end_time: '02:00:00',
  };

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

  it('stays sold out after midnight while an overnight window is still open', () => {
    const markedFridayNight = new Date(2026, 7, 28, 23, 0, 0);
    const saturdayMorning = new Date(2026, 7, 29, 1, 0, 0);
    expect(
      isMarkedUnavailableToday(
        markedFridayNight.toISOString(),
        [fridayNight],
        saturdayMorning
      )
    ).toBe(true);
  });

  it('clears once the overnight window has closed', () => {
    const markedFridayNight = new Date(2026, 7, 28, 23, 0, 0);
    const afterClose = new Date(2026, 7, 29, 3, 0, 0);
    expect(
      isMarkedUnavailableToday(
        markedFridayNight.toISOString(),
        [fridayNight],
        afterClose
      )
    ).toBe(false);
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

describe('isFoodOrderBlocked', () => {
  it('is false for non-food rows and open dishes', () => {
    expect(isFoodOrderBlocked(null)).toBe(false);
    expect(isFoodOrderBlocked(availability())).toBe(false);
  });

  it('blocks sold-out and closed dishes', () => {
    expect(
      isFoodOrderBlocked(availability({ is_marked_unavailable_today: true }))
    ).toBe(true);
    expect(isFoodOrderBlocked(availability({ is_open_now: false }))).toBe(true);
  });
});

describe('foodWeekdayName', () => {
  it('returns Sunday-first weekday names', () => {
    expect(foodWeekdayName(0, 'en-GB')).toBe('Sunday');
    expect(foodWeekdayName(1, 'en-GB')).toBe('Monday');
    expect(foodWeekdayName(5, 'en-GB')).toBe('Friday');
  });
});

describe('formatSlotTime', () => {
  it('drops seconds from Postgres time values', () => {
    expect(formatSlotTime('12:30:00')).toBe('12:30');
  });

  it('pads a single-digit hour', () => {
    expect(formatSlotTime('9:05')).toBe('09:05');
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

describe('sortFoodSlots', () => {
  it('orders by day then start time without mutating the input', () => {
    const input = [
      { day_of_week: 3, start_time: '10:00:00', end_time: '12:00:00' },
      { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
      { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
    ];

    expect(sortFoodSlots(input).map((s) => s.day_of_week)).toEqual([1, 1, 3]);
    expect(input[0].day_of_week).toBe(3);
  });
});

describe('groupFoodSlotsByDay', () => {
  it('groups windows under each weekday in order', () => {
    const actual = groupFoodSlotsByDay([
      { day_of_week: 5, start_time: '20:00:00', end_time: '02:00:00' },
      { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
      { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
    ]);

    expect(actual.map((row) => row.dayOfWeek)).toEqual([1, 5]);
    expect(actual[0].slots).toHaveLength(2);
    expect(actual[0].slots[0].start_time).toBe('12:30:00');
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
    expect(formatNextOpening('nope', 'Africa/Douala', 'en-GB')).toBeNull();
  });
});
