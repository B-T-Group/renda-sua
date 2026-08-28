/**
 * Cooked meals sold by restaurants. Kept separate from the older
 * "Food & Beverages" category, which covers groceries and packaged goods.
 * Must match FOOD_CATEGORY_NAME in the backend.
 */
export const FOOD_CATEGORY_NAME = 'Restaurant & Cooked Food';

/** Default subcategory for cooked dishes in the restaurant category. */
export const FOOD_SUB_CATEGORY_NAME = 'Local Dishes';

/** Sunday first, matching food_availability_slots.day_of_week. */
export const FOOD_WEEKDAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

export function isFoodCategoryName(name?: string | null): boolean {
  return (name ?? '').trim() === FOOD_CATEGORY_NAME;
}

export function isFoodCatalogItem(item: {
  item_sub_category?: { item_category?: { name?: string | null } | null } | null;
  item?: {
    item_sub_category?: { item_category?: { name?: string | null } | null } | null;
  } | null;
}): boolean {
  const name =
    item.item_sub_category?.item_category?.name ??
    item.item?.item_sub_category?.item_category?.name;
  return isFoodCategoryName(name);
}
