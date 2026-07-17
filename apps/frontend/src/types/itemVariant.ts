/** Catalog variant (matches backend / inventory API shape). */
export interface ItemVariantImage {
  id: string;
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  display_order: number;
  is_primary: boolean;
  /** Server-resolved display URL: thumbnail when ready, else image_url. */
  display_url?: string | null;
}

export interface ItemVariant {
  id: string;
  name: string;
  sku?: string | null;
  price?: number | null;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  color?: string | null;
  attributes?: Record<string, unknown> | null;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
  item_variant_images?: ItemVariantImage[];
}

/** Per-location price override on a business_inventory row. */
export interface VariantPriceOverride {
  id?: string;
  item_variant_id: string;
  selling_price: number | string | null;
}

/** Parent item fields used to seed a new variant. */
export interface VariantParentDefaults {
  name: string;
  price: number;
  currency: string;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  color?: string | null;
}

export function primaryVariantImageUrl(
  variant: ItemVariant | null | undefined
): string | null {
  const images = variant?.item_variant_images ?? [];
  if (!images.length) return null;
  const primary =
    images.find((im) => im.is_primary === true) ??
    [...images].sort((a, b) => a.display_order - b.display_order)[0];
  return primary?.display_url ?? primary?.image_url ?? null;
}

/**
 * Effective list unit price before deals:
 * location override → variant price → inventory selling_price.
 */
export function effectiveVariantUnitPrice(
  variant: ItemVariant | null | undefined,
  sellingPrice: number,
  overrides?: VariantPriceOverride[] | null
): number {
  if (variant?.id && overrides?.length) {
    const row = overrides.find((o) => o.item_variant_id === variant.id);
    if (row != null && row.selling_price != null && row.selling_price !== '') {
      const n = Number(row.selling_price);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  }
  if (variant != null && variant.price != null) {
    const n = Number(variant.price);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return sellingPrice;
}

/** Scale listing deal prices onto an arbitrary base unit (e.g. variant-priced SKU). */
export function unitPriceWithListingDeal(
  baseUnit: number,
  listingSellingPrice: number,
  hasActiveDeal: boolean | undefined,
  originalPrice?: number,
  discountedPrice?: number
): { unit: number; strikeOriginal?: number; hasDeal: boolean } {
  const hasDeal =
    !!hasActiveDeal &&
    typeof originalPrice === 'number' &&
    typeof discountedPrice === 'number' &&
    originalPrice > 0 &&
    listingSellingPrice > 0;

  if (!hasDeal) {
    return { unit: baseUnit, hasDeal: false };
  }

  const original = originalPrice as number;
  const discounted = discountedPrice as number;
  return {
    unit: baseUnit * (discounted / listingSellingPrice),
    strikeOriginal: baseUnit * (original / listingSellingPrice),
    hasDeal: true,
  };
}

export function suggestVariantName(
  itemName: string,
  color: string | null | undefined
): string {
  const c = color?.trim();
  if (!c) return '';
  return `${itemName} — ${c}`;
}
