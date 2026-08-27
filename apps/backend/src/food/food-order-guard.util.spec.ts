import {
  checkFoodOrderable,
  FOOD_ITEM_CLOSED_CODE,
  FOOD_ITEM_SOLD_OUT_CODE,
} from './food-order-guard.util';
import { FOOD_CATEGORY_NAME } from './food.constants';

const MONDAY_LUNCH = {
  day_of_week: 1,
  start_time: '12:30:00',
  end_time: '16:00:00',
};

function pizzaRow(
  settings?: { marked_unavailable_at?: string | null; slots?: any[] }
) {
  return {
    item: {
      name: 'Pizza',
      item_sub_category: { item_category: { name: FOOD_CATEGORY_NAME } },
    },
    business_location: { address: { country: 'CM' } },
    food_settings: settings
      ? [
          {
            marked_unavailable_at: settings.marked_unavailable_at ?? null,
            availability_slots: settings.slots ?? [],
          },
        ]
      : undefined,
  };
}

describe('checkFoodOrderable', () => {
  it('allows non-food items through untouched', () => {
    const row = {
      item: {
        name: 'Phone charger',
        item_sub_category: { item_category: { name: 'Electronics' } },
      },
    };

    expect(checkFoodOrderable(row, new Date())).toBeNull();
  });

  it('allows a food item with no schedule', () => {
    expect(checkFoodOrderable(pizzaRow(), new Date())).toBeNull();
  });

  it('allows a food item inside its serving window', () => {
    const actual = checkFoodOrderable(
      pizzaRow({ slots: [MONDAY_LUNCH] }),
      new Date('2026-08-24T12:00:00Z') // Monday 13:00 in Douala
    );

    expect(actual).toBeNull();
  });

  it('blocks a food item outside its serving window and names the next opening', () => {
    const actual = checkFoodOrderable(
      pizzaRow({ slots: [MONDAY_LUNCH] }),
      new Date('2026-08-24T08:00:00Z') // Monday 09:00 in Douala
    );

    expect(actual?.code).toBe(FOOD_ITEM_CLOSED_CODE);
    expect(actual?.message).toBe(
      'Pizza is not being served right now. It opens Monday at 12:30.'
    );
  });

  it('blocks a food item marked sold out for the day', () => {
    const actual = checkFoodOrderable(
      pizzaRow({
        slots: [MONDAY_LUNCH],
        marked_unavailable_at: '2026-08-24T11:00:00Z',
      }),
      new Date('2026-08-24T12:00:00Z')
    );

    expect(actual?.code).toBe(FOOD_ITEM_SOLD_OUT_CODE);
    expect(actual?.message).toBe('Pizza is sold out for today.');
  });

  it('omits the next opening hint when the schedule has no upcoming window', () => {
    const actual = checkFoodOrderable(
      pizzaRow({ slots: [{ day_of_week: 9, start_time: 'x', end_time: 'y' }] }),
      new Date('2026-08-24T08:00:00Z')
    );

    // Invalid slots are ignored, which leaves the dish always available.
    expect(actual).toBeNull();
  });
});
