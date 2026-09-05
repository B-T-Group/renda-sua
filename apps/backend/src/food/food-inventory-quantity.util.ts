import { isFoodCategoryName } from './food-item-availability.mapper';
import { FOOD_DEFAULT_INVENTORY_QUANTITY } from './food.constants';

/**
 * Restaurants cook to order, and storefront visibility needs available
 * quantity above zero, so a cooked-food dish added without a stock count is
 * seeded high instead of being hidden. Merchants who do want to track stock
 * still get the number they asked for.
 */
export function resolveInitialInventoryQuantity(params: {
  requestedQuantity: number;
  categoryName?: string | null;
}): number {
  const { requestedQuantity, categoryName } = params;
  if (!isFoodCategoryName(categoryName)) return requestedQuantity;
  if (requestedQuantity > 0) return requestedQuantity;
  return FOOD_DEFAULT_INVENTORY_QUANTITY;
}
