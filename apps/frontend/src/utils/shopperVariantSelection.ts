import type { ItemVariant } from '../types/itemVariant';

/** Sentinel id for the parent item when the shopper picks the base option. */
export const SHOPPER_BASE_VARIANT_ID = '__base__';

/** Cart line key segment for the base option (not sent as item_variant_id). */
export const CART_BASE_VARIANT_KEY = 'base';

export function isShopperBaseVariantId(
  id: string | null | undefined
): boolean {
  return id === SHOPPER_BASE_VARIANT_ID || id === CART_BASE_VARIANT_KEY;
}

/** UUID to send on create-order / preflight, or undefined for base / unset. */
export function toOrderItemVariantId(
  selectionId: string | null | undefined
): string | undefined {
  if (!selectionId || isShopperBaseVariantId(selectionId)) return undefined;
  return selectionId;
}

/** Value stored on cart lines for line-key uniqueness. */
export function toCartVariantId(
  selectionId: string | null | undefined
): string | undefined {
  if (!selectionId) return undefined;
  if (isShopperBaseVariantId(selectionId)) return CART_BASE_VARIANT_KEY;
  return selectionId;
}

export function activeCatalogVariants(
  variants: ItemVariant[] | null | undefined
): ItemVariant[] {
  return [...(variants ?? [])]
    .filter((v) => v.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** Shopper must pick when the item has at least one DB variant. */
export function catalogRequiresVariantSelection(
  variants: ItemVariant[] | null | undefined
): boolean {
  return activeCatalogVariants(variants).length >= 1;
}

/** Option count shown on catalog chips (base + each active variant). */
export function shopperVariantOptionCount(
  variants: ItemVariant[] | null | undefined
): number {
  const n = activeCatalogVariants(variants).length;
  return n === 0 ? 0 : n + 1;
}

/**
 * Options shown in the picker: base item first, then active variants.
 * Empty when there are no DB variants (no picker).
 */
export function shopperVariantOptions(params: {
  itemName: string;
  defaultLabel: string;
  variants: ItemVariant[] | null | undefined;
  parentImageUrl?: string | null;
}): ItemVariant[] {
  const active = activeCatalogVariants(params.variants);
  if (active.length === 0) return [];

  const base: ItemVariant = {
    id: SHOPPER_BASE_VARIANT_ID,
    name: params.defaultLabel,
    sort_order: -1,
    is_default: true,
    is_active: true,
    ...(params.parentImageUrl
      ? {
          item_variant_images: [
            {
              id: 'base-img',
              image_url: params.parentImageUrl,
              display_order: 0,
              is_primary: true,
            },
          ],
        }
      : {}),
  };

  return [base, ...active];
}
