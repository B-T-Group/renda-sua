import {
  applyCookedFoodCategories,
  isCookedFoodSuggestion,
} from './apply-cooked-food-category';
import {
  FOOD_CATEGORY_NAME,
  FOOD_SUB_CATEGORY_NAME,
} from './food.constants';

describe('isCookedFoodSuggestion', () => {
  it('returns true when the merchant flagged cooked food', () => {
    expect(isCookedFoodSuggestion({ isFoodItem: false }, true)).toBe(true);
  });

  it('returns true when vision detected cooked food', () => {
    expect(isCookedFoodSuggestion({ isFoodItem: true })).toBe(true);
  });
});

describe('applyCookedFoodCategories', () => {
  it('forces the restaurant cooked-food taxonomy', () => {
    const actual = applyCookedFoodCategories({
      categoryName: 'Food & Beverages',
      subCategoryName: 'Snacks',
      categoryAlternates: ['Groceries'],
    });

    expect(actual.categoryName).toBe(FOOD_CATEGORY_NAME);
    expect(actual.subCategoryName).toBe(FOOD_SUB_CATEGORY_NAME);
    expect(actual.isFoodItem).toBe(true);
    expect(actual.categoryAlternates).toEqual([
      'Food & Beverages',
      'Groceries',
    ]);
  });
});
