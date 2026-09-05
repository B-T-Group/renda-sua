export interface FoodConfirmationStockUpdate {
  order_item_id: string;
  /** Portions still for sale after this order. */
  remaining_quantity?: number;
  /** Takes the dish off the menu for the rest of the day. */
  last_one?: boolean;
}

/**
 * Stored quantity that leaves `remainingQuantity` portions for sale. Units on
 * this order stay in `reserved_quantity` until delivery, and available stock is
 * quantity minus reserved, so the reserve has to be added back on top.
 */
export function resolveQuantityForRemaining(params: {
  remainingQuantity: number;
  reservedQuantity: number;
}): number {
  const remaining = Math.max(0, Math.trunc(params.remainingQuantity));
  const reserved = Math.max(0, Math.trunc(params.reservedQuantity));
  return remaining + reserved;
}
