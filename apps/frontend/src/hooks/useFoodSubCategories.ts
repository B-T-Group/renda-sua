import { useMemo } from 'react';
import { isFoodCategoryName } from '../constants/food';
import { ItemSubCategory, useCategories } from './useCategory';

/** Kinds of dish under the cooked-food category, for the Food page filters. */
export function useFoodSubCategories(): {
  subCategories: ItemSubCategory[];
  loading: boolean;
} {
  const { categories, loading } = useCategories();

  const subCategories = useMemo(() => {
    const foodCategory = categories.find((category) =>
      isFoodCategoryName(category.name)
    );
    return foodCategory?.item_sub_categories ?? [];
  }, [categories]);

  return { subCategories, loading };
}
