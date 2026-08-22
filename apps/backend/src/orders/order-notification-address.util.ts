export type OrderNotificationAddress = {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export function resolveOrderNotificationAddress<T extends object>(order: {
  fulfillment_method?: string | null;
  delivery_address?: T | null;
  business_location?: { address?: T | null } | null;
}): T | null {
  const pickupAddress = order.business_location?.address ?? null;
  if (order.fulfillment_method === 'pickup') {
    return pickupAddress;
  }
  return order.delivery_address ?? pickupAddress ?? null;
}
