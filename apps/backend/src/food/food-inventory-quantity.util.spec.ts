import {
  cookedFoodIgnoresStock,
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
