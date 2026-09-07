export type OrderFulfillmentMethod = 'delivery' | 'pickup' | 'shipping';

export function fulfillmentNeedsAddress(
  method: OrderFulfillmentMethod
): boolean {
  return method === 'delivery' || method === 'shipping';
}

export function fulfillmentNeedsWindow(
  method: OrderFulfillmentMethod
): boolean {
  return method === 'delivery' || method === 'pickup';
}

export function isCarrierShipping(
  method?: string | null
): boolean {
  return method === 'shipping';
}

export function cartShippingAvailability(
  groups: { shipping_eligible?: boolean }[]
): { eligible: boolean; partial: boolean } {
  const eligible =
    groups.length > 0 && groups.every((g) => g.shipping_eligible === true);
  return {
    eligible,
    partial: groups.some((g) => g.shipping_eligible === true) && !eligible,
  };
}
