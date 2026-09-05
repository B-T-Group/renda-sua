import { resolveInitialInventoryQuantity } from './food-inventory-quantity.util';
import {
  FOOD_CATEGORY_NAME,
  FOOD_DEFAULT_INVENTORY_QUANTITY,
} from './food.constants';

describe('resolveInitialInventoryQuantity', () => {
  it('seeds cooked food with a high quantity when none is given', () => {
    const actual = resolveInitialInventoryQuantity({
      requestedQuantity: 0,
      categoryName: FOOD_CATEGORY_NAME,
    });

    expect(actual).toBe(FOOD_DEFAULT_INVENTORY_QUANTITY);
  });

  it('keeps a stock count the merchant chose for cooked food', () => {
    const actual = resolveInitialInventoryQuantity({
      requestedQuantity: 12,
      categoryName: FOOD_CATEGORY_NAME,
    });

    expect(actual).toBe(12);
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
