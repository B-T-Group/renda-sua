import {
  everyLineIsCookedFood,
  anyLineIsCookedFood,
  isCookedFoodItem,
  isCookedFoodPickupOrder,
} from './cooked-food-flag.util';

describe('cooked-food-flag.util', () => {
  it('reads the item flag', () => {
    expect(isCookedFoodItem({ is_cooked_food: true })).toBe(true);
    expect(isCookedFoodItem({ is_cooked_food: false })).toBe(false);
    expect(isCookedFoodItem({})).toBe(false);
  });

  it('requires every line to be cooked food', () => {
    expect(
      everyLineIsCookedFood([
        { is_cooked_food: true },
        { is_cooked_food: true },
      ])
    ).toBe(true);
    expect(
      everyLineIsCookedFood([
        { is_cooked_food: true },
        { is_cooked_food: false },
      ])
    ).toBe(false);
    expect(everyLineIsCookedFood([])).toBe(false);
  });

  it('detects any cooked-food line including legacy category', () => {
    expect(
      anyLineIsCookedFood([
        { is_cooked_food: false },
        { is_cooked_food: true },
      ])
    ).toBe(true);
    expect(
      anyLineIsCookedFood([
        {
          item_sub_category: {
            item_category: { name: 'Restaurant & Cooked Food' },
          },
        },
      ])
    ).toBe(true);
    expect(anyLineIsCookedFood([{ is_cooked_food: false }])).toBe(false);
  });

  it('is a cooked-food pickup only for pickup carts of cooked food', () => {
    expect(
      isCookedFoodPickupOrder({
        fulfillmentMethod: 'pickup',
        itemFlags: [{ is_cooked_food: true }],
      })
    ).toBe(true);
    expect(
      isCookedFoodPickupOrder({
        fulfillmentMethod: 'delivery',
        itemFlags: [{ is_cooked_food: true }],
      })
    ).toBe(false);
  });
});
