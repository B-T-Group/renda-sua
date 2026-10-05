import type { Order, OrderItem } from '../types/agent';
import { isFoodCategoryName } from './foodAvailability';

const DONE = new Set(['complete', 'delivered']);

/** A past line that is a cooked dish, not a grocery or general product. */
export function isBoughtFoodLine(line: OrderItem): boolean {
  if (line.is_cooked_food === true || line.item?.is_cooked_food === true) return true;
  return isFoodCategoryName(line.item?.item_sub_category?.item_category?.name);
}

/**
 * Newest completed order for Buy again.
 * On restaurants, skip orders with no cooked-food lines and return only those lines.
 */
export function selectBuyAgainOrder(
  orders: Order[],
  foodOnly: boolean
): { order: Order; lines: OrderItem[] } | null {
  for (const order of orders) {
    if (!DONE.has(order.current_status)) continue;
    const lines = order.order_items ?? [];
    if (!foodOnly) return { order, lines };
    const food = lines.filter(isBoughtFoodLine);
    if (food.length > 0) return { order, lines: food };
  }
  return null;
}
