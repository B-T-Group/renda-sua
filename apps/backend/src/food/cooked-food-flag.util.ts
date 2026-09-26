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

type CookedFoodLine = {
  is_cooked_food?: boolean | null;
  item_sub_category?: {
    item_category?: { name?: string | null } | null;
  } | null;
} | null | undefined;

/**
 * True when a line is cooked food. Food category wins over an explicit
 * `is_cooked_food: false` (same rule as stock) so mis-flagged dishes still
 * skip reservation deposits and use pay-after-confirm.
 */
export function lineIsCookedFood(line: CookedFoodLine): boolean {
  if (!line) return false;
  if (line.is_cooked_food === true) return true;
  if (isFoodCategoryName(line.item_sub_category?.item_category?.name)) {
    return true;
  }
  return false;
}

/** True when every line is cooked food (empty list is false). */
export function everyLineIsCookedFood(lines: CookedFoodLine[]): boolean {
  if (!lines.length) return false;
  return lines.every((line) => lineIsCookedFood(line));
}

/**
 * True when any line is cooked food (flag preferred; category is legacy
 * fallback when the flag is unset or wrongly false).
 */
export function anyLineIsCookedFood(lines: CookedFoodLine[]): boolean {
  return lines.some((line) => lineIsCookedFood(line));
}

/**
 * Checkout snapshot: delivery or pickup where every catalog line is cooked food.
 * Used for MoMo pay-after-merchant-confirm and to skip reservation deposits.
 */
export function isCookedFoodFulfillmentOrder(params: {
  fulfillmentMethod?: string | null;
  itemFlags: Array<CookedFoodLine>;
}): boolean {
  const method = params.fulfillmentMethod;
  if (method !== 'pickup' && method !== 'delivery') return false;
  return everyLineIsCookedFood(params.itemFlags);
}

/**
 * Checkout snapshot: ASAP pickup where every catalog line is cooked food.
 * Callers pass fulfillment_method === 'pickup' and the item flags from the cart.
 * Keeps is_cooked_food_pickup / no-PIN complete path pickup-only.
 */
export function isCookedFoodPickupOrder(params: {
  fulfillmentMethod?: string | null;
  itemFlags: Array<CookedFoodLine>;
}): boolean {
  if (params.fulfillmentMethod !== 'pickup') return false;
  return everyLineIsCookedFood(params.itemFlags);
}
