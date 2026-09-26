import { isFoodCategoryName } from './food-item-availability.mapper';

/**
 * Helpers for the durable cooked-food item flag (items.is_cooked_food).
 * Prefer this over category-name checks for payment and stock behavior.
 */

export function isCookedFoodItem(item: {
  is_cooked_food?: boolean | null;
} | null | undefined): boolean {
  return item?.is_cooked_food === true;
}

/** True when every line is cooked food (empty list is false). */
export function everyLineIsCookedFood(
  lines: Array<{ is_cooked_food?: boolean | null } | null | undefined>
): boolean {
  if (!lines.length) return false;
  return lines.every((line) => isCookedFoodItem(line));
}

type CookedFoodLine = {
  is_cooked_food?: boolean | null;
  item_sub_category?: {
    item_category?: { name?: string | null } | null;
  } | null;
} | null | undefined;

/**
 * True when any line is cooked food (flag preferred; category is legacy
 * fallback when the flag is unset).
 */
export function anyLineIsCookedFood(lines: CookedFoodLine[]): boolean {
  return lines.some((line) => {
    if (!line) return false;
    if (line.is_cooked_food === true) return true;
    if (line.is_cooked_food === false) return false;
    return isFoodCategoryName(line.item_sub_category?.item_category?.name);
  });
}

/**
 * Checkout snapshot: ASAP pickup where every catalog line is cooked food.
 * Callers pass fulfillment_method === 'pickup' and the item flags from the cart.
 */
export function isCookedFoodPickupOrder(params: {
  fulfillmentMethod?: string | null;
  itemFlags: Array<{ is_cooked_food?: boolean | null } | null | undefined>;
}): boolean {
  if (params.fulfillmentMethod !== 'pickup') return false;
  return everyLineIsCookedFood(params.itemFlags);
}
