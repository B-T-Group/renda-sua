import {
  buildFoodAvailabilityPayload,
  isFoodRow,
  resolveRowTimezone,
} from './food-item-availability.mapper';
import { FOOD_CATEGORY_NAME } from './food.constants';

function foodRow(overrides: Record<string, unknown> = {}) {
  return {
    item: {
      item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } },
    },
    business_location: { address: { country: 'CM' } },
    ...overrides,
  };
}

describe('isFoodRow', () => {
  it('recognises the cooked-food category', () => {
    expect(isFoodRow(foodRow())).toBe(true);
  });

  it('does not treat the grocery category as cooked food', () => {
    const row = {
      item: {
        item_sub_category: { item_category: { name: 'Food & Beverages' } },
      },
    };

    expect(isFoodRow(row)).toBe(false);
  });

  it('handles rows with no category data', () => {
    expect(isFoodRow({})).toBe(false);
  });
});

describe('resolveRowTimezone', () => {
  it('maps the location country to a timezone', () => {
    expect(resolveRowTimezone(foodRow())).toBe('Africa/Douala');
  });

  it('falls back to the platform default when country is missing', () => {
    expect(resolveRowTimezone({})).toBe('Africa/Douala');
  });
});

describe('buildFoodAvailabilityPayload', () => {
  it('returns null for non-food rows so other items stay untouched', () => {
    const row = {
      item: { item_sub_category: { item_category: { name: 'Electronics' } } },
    };

    expect(buildFoodAvailabilityPayload(row, new Date())).toBeNull();
  });

  it('reports always available when no schedule exists', () => {
    const actual = buildFoodAvailabilityPayload(foodRow(), new Date());

    expect(actual).not.toBeNull();
    expect(actual?.has_schedule).toBe(false);
    expect(actual?.is_available_now).toBe(true);
    expect(actual?.slots).toEqual([]);
  });

  it('uses the location settings row to resolve the window', () => {
    const row = foodRow({
      food_settings: [
        {
          marked_unavailable_at: null,
          availability_slots: [
            { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
          ],
        },
      ],
    });

    // Monday 2026-08-24 13:00 in Douala (UTC+1)
    const actual = buildFoodAvailabilityPayload(
      row,
      new Date('2026-08-24T12:00:00Z')
    );

    expect(actual?.has_schedule).toBe(true);
    expect(actual?.is_open_now).toBe(true);
    expect(actual?.is_available_now).toBe(true);
    expect(actual?.timezone).toBe('Africa/Douala');
  });

  it('reports the next opening when the window has not started', () => {
    const row = foodRow({
      food_settings: [
        {
          marked_unavailable_at: null,
          availability_slots: [
            { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
          ],
        },
      ],
    });

    // Monday 2026-08-24 09:00 in Douala
    const actual = buildFoodAvailabilityPayload(
      row,
      new Date('2026-08-24T08:00:00Z')
    );

    expect(actual?.is_open_now).toBe(false);
    expect(actual?.next_opening_at).toBe('2026-08-24T11:30:00.000Z');
  });

  it('reports sold out when flagged earlier the same day', () => {
    const row = foodRow({
      food_settings: [
        {
          marked_unavailable_at: '2026-08-24T11:00:00Z',
          availability_slots: [
            { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
          ],
        },
      ],
    });

    const actual = buildFoodAvailabilityPayload(
      row,
      new Date('2026-08-24T12:00:00Z')
    );

    expect(actual?.is_open_now).toBe(true);
    expect(actual?.is_marked_unavailable_today).toBe(true);
    expect(actual?.is_available_now).toBe(false);
  });

  it('sorts slots by day then start time', () => {
    const row = foodRow({
      food_settings: [
        {
          availability_slots: [
            { day_of_week: 3, start_time: '10:00:00', end_time: '12:00:00' },
            { day_of_week: 1, start_time: '18:00:00', end_time: '21:00:00' },
            { day_of_week: 1, start_time: '12:30:00', end_time: '16:00:00' },
          ],
        },
      ],
    });

    const actual = buildFoodAvailabilityPayload(row, new Date());

    expect(actual?.slots.map((s) => [s.day_of_week, s.start_time])).toEqual([
      [1, '12:30:00'],
      [1, '18:00:00'],
      [3, '10:00:00'],
    ]);
  });
});
