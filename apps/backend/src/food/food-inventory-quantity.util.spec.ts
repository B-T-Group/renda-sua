import {
  cookedFoodIgnoresStock,
  resolveCookedFoodMinOrderQuantity,
  resolveInitialInventoryQuantity,
} from './food-inventory-quantity.util';
import {
  FOOD_CATEGORY_NAME,
  FOOD_DEFAULT_INVENTORY_QUANTITY,
} from './food.constants';

describe('cookedFoodIgnoresStock', () => {
  it('is true for the cooked-food category', () => {
    expect(cookedFoodIgnoresStock(FOOD_CATEGORY_NAME)).toBe(true);
  });

  it('is false for groceries and unknown categories', () => {
    expect(cookedFoodIgnoresStock('Food & Beverages')).toBe(false);
    expect(cookedFoodIgnoresStock(null)).toBe(false);
  });

  it('is true when the durable cooked-food flag is set', () => {
    expect(cookedFoodIgnoresStock('Retail & Shopping', true)).toBe(true);
  });

  it('still ignores stock for food category even if the flag is false', () => {
    // Sentinel quantity is category-based; a false flag must not reserve it.
    expect(cookedFoodIgnoresStock(FOOD_CATEGORY_NAME, false)).toBe(true);
  });

  it('tracks stock when flag is false outside the food category', () => {
    expect(cookedFoodIgnoresStock('Retail & Shopping', false)).toBe(false);
  });
});

describe('resolveInitialInventoryQuantity', () => {
  it('always stores quantity 1 for cooked food', () => {
    expect(
      resolveInitialInventoryQuantity({
        requestedQuantity: 0,
        categoryName: FOOD_CATEGORY_NAME,
      })
    ).toBe(FOOD_DEFAULT_INVENTORY_QUANTITY);
    expect(
      resolveInitialInventoryQuantity({
        requestedQuantity: 12,
        categoryName: FOOD_CATEGORY_NAME,
      })
    ).toBe(1);
  });

  it('leaves non-food items alone, including zero stock', () => {
    expect(
      resolveInitialInventoryQuantity({
        requestedQuantity: 0,
        categoryName: 'Retail & Shopping',
      })
    ).toBe(0);
  });

  it('leaves items with an unknown category alone', () => {
    expect(
      resolveInitialInventoryQuantity({ requestedQuantity: 0 })
    ).toBe(0);
  });
});

describe('resolveCookedFoodMinOrderQuantity', () => {
  it('always returns 1 for cooked food', () => {
    expect(
      resolveCookedFoodMinOrderQuantity({
        requestedMin: 80,
        categoryName: FOOD_CATEGORY_NAME,
      })
    ).toBe(1);
  });

  it('keeps a valid min for non-food items', () => {
    expect(
      resolveCookedFoodMinOrderQuantity({
        requestedMin: 3,
        categoryName: 'Retail & Shopping',
      })
    ).toBe(3);
  });

  it('defaults missing non-food mins to 1', () => {
    expect(
      resolveCookedFoodMinOrderQuantity({
        requestedMin: null,
        categoryName: 'Retail & Shopping',
      })
    ).toBe(1);
  });
});
