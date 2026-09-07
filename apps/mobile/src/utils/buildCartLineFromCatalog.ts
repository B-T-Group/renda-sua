import type { CartLine } from '../types/cart';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import { catalogOrderedImages } from './catalogInventoryDisplay';
import { merchantCanAcceptOrders } from './merchantLifecycle';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../types/business/itemVariant';
import {
  activeCatalogVariants,
  catalogRequiresVariantSelection as requiresFromVariants,
  isShopperBaseVariantId,
  shopperVariantOptionCount as optionCountFromVariants,
  SHOPPER_BASE_VARIANT_ID,
  toCartVariantId,
} from './shopperVariantSelection';

export function catalogRequiresVariantSelection(
  item: CatalogInventoryItem
): boolean {
  return requiresFromVariants(item.item.item_variants);
}

export function shopperVariantOptionCount(item: CatalogInventoryItem): number {
  return optionCountFromVariants(item.item.item_variants);
}

function unitPriceForVariant(
  item: CatalogInventoryItem,
  variantId: string | null
): number {
  if (!variantId || isShopperBaseVariantId(variantId)) {
    return unitPriceWithListingDeal(
      item.selling_price,
      item.selling_price,
      item.hasActiveDeal,
      item.original_price,
      item.discounted_price
    ).unit;
  }
  const variant = item.item.item_variants?.find(
    (candidate) => candidate.id === variantId
  );
  const override = item.variant_price_overrides?.find(
    (candidate) => candidate.item_variant_id === variantId
  );
  const base = effectiveVariantUnitPrice(variant, item.selling_price, override);
  return unitPriceWithListingDeal(
    base,
    item.selling_price,
    item.hasActiveDeal,
    item.original_price,
    item.discounted_price
  ).unit;
}

/** Unit price for the shopper's card selection (base or concrete variant). */
export function catalogUnitPriceForSelection(
  item: CatalogInventoryItem,
  selectionId: string | null | undefined
): number {
  return unitPriceForVariant(item, selectionId ?? null);
}

/** Lowest unit price across base + variant options (for “From $X” on catalog cards). */
export function catalogFromPrice(item: CatalogInventoryItem): number {
  const variants = activeCatalogVariants(item.item.item_variants);
  if (variants.length < 1) {
    return catalogUnitPriceForSelection(item, null);
  }
  const prices = [
    catalogUnitPriceForSelection(item, SHOPPER_BASE_VARIANT_ID),
    ...variants.map((variant) => catalogUnitPriceForSelection(item, variant.id)),
  ];
  return Math.min(...prices);
}

function resolveVariantName(
  item: CatalogInventoryItem,
  selectionId: string | null,
  baseLabel: string
): string | undefined {
  if (!selectionId) return undefined;
  if (isShopperBaseVariantId(selectionId)) return baseLabel;
  const v = item.item.item_variants?.find((x) => x.id === selectionId);
  return v?.name?.trim() || undefined;
}

/**
 * Builds a cart line from a catalog row.
 * Pass `__base__` / `base` for the parent-item option when variants exist.
 * Throws ITEM_VARIANT_REQUIRED when options exist and none was chosen.
 */
export function buildCartLineFromCatalog(
  item: CatalogInventoryItem,
  quantity: number,
  variantIdOverride?: string | null,
  baseVariantLabel = 'Default'
): CartLine {
  const variants = activeCatalogVariants(item.item.item_variants);
  const selection =
    variantIdOverride !== undefined ? variantIdOverride : null;

  if (variants.length >= 1 && !selection) {
    throw new Error('ITEM_VARIANT_REQUIRED');
  }

  const cartVariantId = toCartVariantId(selection) ?? null;
  const price = unitPriceForVariant(item, selection);
  const imgs = catalogOrderedImages(item);
  const variant =
    selection && !isShopperBaseVariantId(selection)
      ? item.item.item_variants?.find((candidate) => candidate.id === selection)
      : undefined;
  const variantImage = primaryVariantImageUrl(variant);
  const minQ = Math.max(1, item.item.min_order_quantity ?? 1);
  const cap = item.item.max_order_quantity ?? item.computed_available_quantity;
  const maxQ = Math.max(minQ, Math.min(cap, item.computed_available_quantity));
  const qty = Math.min(Math.max(quantity, minQ), maxQ);

  const rawCountry = item.business_location?.address?.country;
  const sellerCountry =
    typeof rawCountry === 'string' && rawCountry.trim()
      ? rawCountry.trim().toUpperCase()
      : undefined;

  const name = resolveVariantName(item, selection, baseVariantLabel);

  return {
    inventoryItemId: item.id,
    ...(cartVariantId
      ? { variantId: cartVariantId, variantName: name }
      : {}),
    quantity: qty,
    businessId: item.business_location.business_id,
    businessLocationId: item.business_location.id,
    businessName:
      item.business_location.business?.name?.trim() ||
      item.business_location.name?.trim(),
    ...(sellerCountry ? { sellerCountry } : {}),
    itemData: {
      name: item.item.name,
      price,
      currency: item.item.currency || 'XAF',
      imageUrl: variantImage ?? imgs[0]?.image_url,
      maxOrderQuantity: maxQ,
      minOrderQuantity: minQ,
      payOnDeliveryEnabled: Boolean(item.item.pay_on_delivery_enabled),
      merchantCanAcceptOrders: merchantCanAcceptOrders(
        item.business_location.business
      ),
    },
  };
}
