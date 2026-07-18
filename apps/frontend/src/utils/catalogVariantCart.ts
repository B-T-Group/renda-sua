import type { CartItem } from '../contexts/CartContext';
import type { InventoryItem } from '../hooks/useInventoryItems';
import type { ItemVariant } from '../types/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../types/itemVariant';
import { orderedItemImages } from './orderedItemImages';

export function activeCatalogVariants(
  item: InventoryItem | null | undefined
): ItemVariant[] {
  const raw = item?.item?.item_variants ?? [];
  return [...raw]
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** True when the shopper must open detail to pick an option before cart/order. */
export function catalogRequiresVariantSelection(
  item: InventoryItem | null | undefined
): boolean {
  return activeCatalogVariants(item).length > 1;
}

/** Auto-select when there is exactly one active variant; otherwise null. */
export function defaultCatalogVariantId(
  item: InventoryItem | null | undefined
): string | null {
  const variants = activeCatalogVariants(item);
  if (variants.length === 1) return variants[0].id;
  return null;
}

export function catalogVariantById(
  item: InventoryItem,
  variantId: string | null | undefined
): ItemVariant | null {
  if (!variantId) return null;
  return activeCatalogVariants(item).find((v) => v.id === variantId) ?? null;
}

export function catalogUnitPriceForVariant(
  item: InventoryItem,
  variantId: string | null | undefined
): {
  unit: number;
  strikeOriginal?: number;
  hasDeal: boolean;
} {
  const variant = catalogVariantById(item, variantId);
  const base = effectiveVariantUnitPrice(
    variant,
    item.selling_price,
    item.variant_price_overrides
  );
  return unitPriceWithListingDeal(
    base,
    item.selling_price,
    item.hasActiveDeal,
    item.original_price,
    item.discounted_price
  );
}

/**
 * Builds a cart line from a list/card inventory row.
 * Returns `needs_variant` when multiple options exist and none was chosen.
 */
export function buildCartItemFromInventory(
  item: InventoryItem,
  quantity = 1,
  variantIdOverride?: string | null
): CartItem | 'needs_variant' {
  const variants = activeCatalogVariants(item);
  const variantId =
    variantIdOverride !== undefined && variantIdOverride !== null
      ? variantIdOverride
      : defaultCatalogVariantId(item);

  if (variants.length > 1 && !variantId) {
    return 'needs_variant';
  }

  const variant = catalogVariantById(item, variantId);
  const pricing = catalogUnitPriceForVariant(item, variantId);
  const parentImage = orderedItemImages(item.item.item_images)[0]?.image_url;
  const variantImage = primaryVariantImageUrl(variant) || undefined;

  return {
    inventoryItemId: item.id,
    quantity,
    ...(variantId
      ? { variantId, variantName: variant?.name?.trim() || undefined }
      : {}),
    businessId: item.business_location.business_id,
    businessLocationId: item.business_location_id,
    itemData: {
      name: item.item.name,
      price: pricing.unit,
      currency: item.item.currency,
      imageUrl: parentImage,
      ...(variantImage ? { variantImageUrl: variantImage } : {}),
      weight: item.item.weight,
      maxOrderQuantity: item.item.max_order_quantity || undefined,
      minOrderQuantity: item.item.min_order_quantity || undefined,
      originalPrice: pricing.hasDeal ? pricing.strikeOriginal : undefined,
      discountedPrice: pricing.hasDeal ? pricing.unit : undefined,
      hasActiveDeal: pricing.hasDeal,
      dealEndAt: pricing.hasDeal ? item.deal_end_at : undefined,
      merchantCanAcceptOrders:
        item.business_location.business.can_accept_orders ??
        item.business_location.business.is_verified ??
        false,
    },
  };
}
