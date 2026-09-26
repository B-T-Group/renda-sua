import { isFoodCategoryName } from './food-item-availability.mapper';
import { FOOD_DEFAULT_INVENTORY_QUANTITY } from './food.constants';

/**
 * True when stock counts, reserves, and decrements must be skipped.
 * Prefer items.is_cooked_food; category name is only a legacy fallback.
 */
export function cookedFoodIgnoresStock(
  categoryName?: string | null,
  isCookedFood?: boolean | null
): boolean {
  if (isCookedFood === true) return true;
  if (isCookedFood === false) return false;
  return isFoodCategoryName(categoryName);
}

/**
 * Cooked food always stores quantity 1. Merchants cannot set a stock count;
 * availability is controlled per location (is_active / sold out today).
 */
export function resolveInitialInventoryQuantity(params: {
  requestedQuantity: number;
  categoryName?: string | null;
  isCookedFood?: boolean | null;
}): number {
  const { requestedQuantity, categoryName, isCookedFood } = params;
  if (!cookedFoodIgnoresStock(categoryName, isCookedFood)) {
    return requestedQuantity;
  }
  return FOOD_DEFAULT_INVENTORY_QUANTITY;
}

/** Cooked food minimum order is always 1 and is not merchant-editable. */
export function resolveCookedFoodMinOrderQuantity(params: {
  requestedMin?: number | null;
  categoryName?: string | null;
  isCookedFood?: boolean | null;
}): number {
  if (cookedFoodIgnoresStock(params.categoryName, params.isCookedFood)) {
    return 1;
  }
  const requested = params.requestedMin;
  if (requested == null || !Number.isFinite(requested)) return 1;
  return Math.max(1, Math.trunc(requested));
}
