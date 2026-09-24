import { isFoodCategoryName } from './food-item-availability.mapper';
import { FOOD_DEFAULT_INVENTORY_QUANTITY } from './food.constants';

/**
 * True when stock counts, reserves, and decrements must be skipped.
 * Quantity 1 is only a visibility sentinel, not a sellable count.
 */
export function cookedFoodIgnoresStock(categoryName?: string | null): boolean {
  return isFoodCategoryName(categoryName);
}

/**
 * Cooked food always stores quantity 1. Merchants cannot set a stock count;
 * availability is controlled per location (is_active / sold out today).
 */
export function resolveInitialInventoryQuantity(params: {
  requestedQuantity: number;
  categoryName?: string | null;
}): number {
  const { requestedQuantity, categoryName } = params;
  if (!cookedFoodIgnoresStock(categoryName)) return requestedQuantity;
  return FOOD_DEFAULT_INVENTORY_QUANTITY;
}
