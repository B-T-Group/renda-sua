/** Catalog variant (matches backend / inventory API shape). */
export interface ItemVariantImage {
  id: string;
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  display_order: number;
  is_primary: boolean;
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

export function primaryVariantImageUrl(
  variant: ItemVariant | null | undefined
): string | null {
  const images = variant?.item_variant_images ?? [];
  if (!images.length) return null;
  const primary =
    images.find((im) => im.is_primary === true) ??
    [...images].sort((a, b) => a.display_order - b.display_order)[0];
  return primary?.image_url ?? null;
}

/** Effective list unit price before deals: variant override or listing selling_price */
export function effectiveVariantUnitPrice(
  variant: ItemVariant | null | undefined,
  sellingPrice: number
): number {
  if (variant != null && variant.price != null) {
    const n = Number(variant.price);
    if (!Number.isNaN(n)) return n;
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

  return {
    unit: baseUnit * (discountedPrice! / listingSellingPrice),
    strikeOriginal: baseUnit * (originalPrice! / listingSellingPrice),
    hasDeal: true,
  };
}
