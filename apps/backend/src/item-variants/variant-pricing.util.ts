/**
 * Shared effective unit-price resolution for item variants.
 *
 * Base resolution (location override → variant price → inventory selling_price).
 * Listing deals are applied to that base elsewhere (orders / catalog).
 *
 * v1 notes:
 * - Shared stock on business_inventory; overrides are price-only.
 * - Shopify per-variant inventory rows (item_variant_id on business_inventory)
 *   remain valid but are outside the merchant override UX.
 * - Public browse may surface one listing per item_id; overrides on non-winning
 *   location rows are invisible until that location is the surfaced listing.
 * - Browse min_price/max_price still filter on inventory selling_price only.
 */

export type VariantPriceOverrideRow = {
  item_variant_id: string;
  selling_price: number | string | null | undefined;
};

export type CatalogVariantLike = {
  id: string;
  price?: number | string | null;
  is_active?: boolean | null;
};

/**
 * Resolve base unit price before deals.
 * Prefer location override for the selected variant, then variant.price, then inventory.
 */
export function resolveEffectiveUnitPrice(params: {
  inventorySellingPrice: number | string | null | undefined;
  variant?: CatalogVariantLike | null;
  overrides?: VariantPriceOverrideRow[] | null;
}): number {
  const { inventorySellingPrice, variant, overrides } = params;
  if (variant?.id && overrides?.length) {
    const row = overrides.find((o) => o.item_variant_id === variant.id);
    if (row != null && row.selling_price != null && row.selling_price !== '') {
      const n = Number(row.selling_price);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  }
  if (variant != null && variant.price != null && variant.price !== '') {
    const n = Number(variant.price);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  const inv = Number(inventorySellingPrice ?? 0);
  return Number.isNaN(inv) ? 0 : inv;
}

/** Active variants only for shopper selection. */
export function activeCatalogVariants<T extends CatalogVariantLike>(
  variants: T[] | null | undefined
): T[] {
  return (variants ?? []).filter((v) => v.is_active !== false);
}

export function findOverrideForVariant(
  overrides: VariantPriceOverrideRow[] | null | undefined,
  variantId: string | null | undefined
): VariantPriceOverrideRow | null {
  if (!variantId || !overrides?.length) return null;
  return overrides.find((o) => o.item_variant_id === variantId) ?? null;
}
