import type { CartLine } from '../types/cart';
import type { ReorderCartAction, ReorderLine } from '../types/reorder';

/** Decide replace vs add when applying a reorder payload to an existing cart. */
export function resolveReorderCartAction(
  cartBusinessIds: string[],
  reorderBusinessId: string
): ReorderCartAction {
  if (cartBusinessIds.length === 0) return 'replace';
  const otherStore = cartBusinessIds.some((id) => id !== reorderBusinessId);
  if (otherStore) return 'blocked_other_store';
  return 'add';
}

export function mapReorderLineToCartLine(
  line: ReorderLine,
  businessId: string
): CartLine {
  return {
    inventoryItemId: line.business_inventory_id,
    ...(line.item_variant_id
      ? { variantId: line.item_variant_id, variantName: line.variant_name ?? undefined }
      : {}),
    quantity: line.quantity,
    businessId,
    businessLocationId: line.business_location_id,
    businessName: line.item_data.business_name ?? undefined,
    sellerCountry: line.item_data.seller_country ?? undefined,
    itemData: {
      name: line.item_data.name,
      price: line.item_data.price,
      currency: line.item_data.currency,
      imageUrl: line.item_data.image_url ?? undefined,
      maxOrderQuantity: line.item_data.max_order_quantity ?? undefined,
      minOrderQuantity: line.item_data.min_order_quantity ?? undefined,
      payOnDeliveryEnabled: line.item_data.pay_on_delivery_enabled ?? undefined,
      merchantCanAcceptOrders: line.item_data.merchant_can_accept_orders ?? undefined,
    },
  };
}

/** Format skipped names: max 2 names + "and n more". */
export function formatSkippedNames(
  names: string[],
  andMoreLabel: (n: number) => string
): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, ${names[1]}`;
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]} ${andMoreLabel(rest)}`;
}
