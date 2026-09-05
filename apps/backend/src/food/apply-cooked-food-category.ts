import {
  FOOD_CATEGORY_NAME,
  FOOD_SUB_CATEGORY_NAME,
} from './food.constants';

export type CookedFoodCategorySuggestion = {
  categoryName?: string;
  subCategoryName?: string;
  isFoodItem?: boolean | null;
  categoryAlternates?: string[];
  subCategoryAlternates?: string[];
  confidence?: {
    categoryName?: string;
    subCategoryName?: string;
  };
};

export function isCookedFoodSuggestion(
  suggestion: Pick<CookedFoodCategorySuggestion, 'isFoodItem'>,
  merchantFlag?: boolean | null
): boolean {
  return merchantFlag === true || suggestion.isFoodItem === true;
}

export function applyCookedFoodCategories<T extends CookedFoodCategorySuggestion>(
  suggestion: T
): T {
  const categoryAlternates = [...(suggestion.categoryAlternates ?? [])];
  const subCategoryAlternates = [...(suggestion.subCategoryAlternates ?? [])];
  if (
    suggestion.categoryName &&
    suggestion.categoryName !== FOOD_CATEGORY_NAME &&
    !categoryAlternates.includes(suggestion.categoryName)
  ) {
    categoryAlternates.unshift(suggestion.categoryName);
  }
  if (
    suggestion.subCategoryName &&
    suggestion.subCategoryName !== FOOD_SUB_CATEGORY_NAME &&
    !subCategoryAlternates.includes(suggestion.subCategoryName)
  ) {
    subCategoryAlternates.unshift(suggestion.subCategoryName);
  }

  return {
    ...suggestion,
    isFoodItem: true,
    categoryName: FOOD_CATEGORY_NAME,
    subCategoryName: FOOD_SUB_CATEGORY_NAME,
    categoryAlternates: categoryAlternates.slice(0, 3),
    subCategoryAlternates: subCategoryAlternates.slice(0, 3),
    confidence: suggestion.confidence
      ? {
          ...suggestion.confidence,
          categoryName: 'high',
          subCategoryName: 'high',
        }
      : suggestion.confidence,
  };
}
