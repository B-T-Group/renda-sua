import type { CartItem } from '../contexts/CartContext';
import type { InventoryItem } from '../hooks/useInventoryItems';
import type { ItemVariant } from '../types/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../types/itemVariant';
import { orderedItemImages } from './orderedItemImages';
import {
  CART_BASE_VARIANT_KEY,
  activeCatalogVariants as activeVariantsFromList,
  catalogRequiresVariantSelection as requiresSelectionFromVariants,
  isShopperBaseVariantId,
  shopperVariantOptionCount as optionCountFromVariants,
  toCartVariantId,
  toOrderItemVariantId,
} from './shopperVariantSelection';

export {
  toCartVariantId,
  toOrderItemVariantId,
  isShopperBaseVariantId,
  CART_BASE_VARIANT_KEY,
};

export function activeCatalogVariants(
  item: InventoryItem | null | undefined
): ItemVariant[] {
  return activeVariantsFromList(item?.item?.item_variants);
}

export function catalogRequiresVariantSelection(
  item: InventoryItem | null | undefined
): boolean {
  return requiresSelectionFromVariants(item?.item?.item_variants);
}

export function shopperVariantOptionCount(
  item: InventoryItem | null | undefined
): number {
  return optionCountFromVariants(item?.item?.item_variants);
}

export function catalogVariantById(
  item: InventoryItem,
  variantId: string | null | undefined
): ItemVariant | null {
  if (!variantId || isShopperBaseVariantId(variantId)) return null;
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
 * Returns `needs_variant` when options exist and none was chosen.
 * Pass `__base__` or `base` for the parent-item option.
 */
export function buildCartItemFromInventory(
  item: InventoryItem,
  quantity = 1,
  variantIdOverride?: string | null,
  baseVariantLabel = 'Default'
): CartItem | 'needs_variant' {
  const variants = activeCatalogVariants(item);
  const selection =
    variantIdOverride !== undefined && variantIdOverride !== null
      ? variantIdOverride
      : null;

  if (variants.length >= 1 && !selection) {
    return 'needs_variant';
  }

  const cartVariantId = toCartVariantId(selection);
  const variant = catalogVariantById(item, selection);
  const pricing = catalogUnitPriceForVariant(item, selection);
  const parentImage = orderedItemImages(item.item.item_images)[0]?.image_url;
  const variantImage = primaryVariantImageUrl(variant) || undefined;
  const isBase = isShopperBaseVariantId(selection);

  return {
    inventoryItemId: item.id,
    quantity,
    ...(cartVariantId
      ? {
          variantId: cartVariantId,
          variantName: isBase
            ? baseVariantLabel
            : variant?.name?.trim() || undefined,
        }
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
