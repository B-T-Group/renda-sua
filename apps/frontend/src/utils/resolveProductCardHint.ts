export type ProductCardHint =
  | { id: 'food_closed' }
  | { id: 'food_open' }
  | { id: 'low_stock'; count: number }
  | { id: 'check_availability' }
  | { id: 'deal' }
  | { id: 'fulfillment'; label: string };

const LOW_STOCK_MAX = 5;

/** One contextual line for a product card. Earlier reasons win. */
export function resolveProductCardHint(input: {
  quantity?: number | null;
  isFood?: boolean;
  foodOpen?: boolean | null;
  hasDeal?: boolean;
  fulfillmentHint?: string | null;
}): ProductCardHint | null {
  if (input.isFood) {
    if (input.foodOpen === false) return { id: 'food_closed' };
    if (input.foodOpen === true) return { id: 'food_open' };
  }
  const quantity = input.quantity;
  if (typeof quantity === 'number' && quantity > 0 && quantity <= LOW_STOCK_MAX) {
    return { id: 'low_stock', count: quantity };
  }
  if (quantity === 0) return { id: 'check_availability' };
  return input.hasDeal
    ? { id: 'deal' }
    : input.fulfillmentHint
      ? { id: 'fulfillment', label: input.fulfillmentHint }
      : null;
}
