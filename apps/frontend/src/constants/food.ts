/**
 * Cooked meals sold by restaurants. Kept separate from the older
 * "Food & Beverages" category, which covers groceries and packaged goods.
 * Must match FOOD_CATEGORY_NAME in the backend.
 */
export const FOOD_CATEGORY_NAME = 'Restaurant & Cooked Food';

/** Sunday first, matching food_availability_slots.day_of_week. */
export const FOOD_WEEKDAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

export function isFoodCategoryName(name?: string | null): boolean {
  return (name ?? '').trim() === FOOD_CATEGORY_NAME;
}
