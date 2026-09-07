/** Catalog variant shared by business management and shopper pricing. */
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

export type ItemVariantInput = Omit<ItemVariant, 'id' | 'item_variant_images'>;

/** AI-suggested fields for a new variant of a parent item. */
export interface VariantSuggestion {
  name?: string;
  color?: string;
  sku?: string;
  price?: number;
  currency?: string;
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
}

export interface InventoryVariantPriceOverride {
  id?: string;
  item_variant_id: string;
  selling_price: number;
}

export interface VariantPriceOverrideInput {
  item_variant_id: string;
  selling_price: number | null;
}

export function primaryVariantImageUrl(variant?: ItemVariant | null): string | null {
  const images = variant?.item_variant_images ?? [];
  const best =
    images.find((image) => image.is_primary) ??
    [...images].sort((a, b) => a.display_order - b.display_order)[0];
  const url = best?.display_url?.trim() || best?.image_url?.trim();
  return url || null;
}

/** Ordered gallery for a variant (primary first). Empty when the variant has no photos. */
export function orderedVariantImages(
  variant?: ItemVariant | null
): ItemVariantImage[] {
  const images = variant?.item_variant_images ?? [];
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
}

export function effectiveVariantUnitPrice(
  variant: ItemVariant | null | undefined,
  inventoryPrice: number,
  override?: InventoryVariantPriceOverride | null
): number {
  if (override?.selling_price != null) return Number(override.selling_price);
  if (variant?.price != null) return Number(variant.price);
  return Number(inventoryPrice);
}

/** Applies a listing deal ratio to the effective override/variant/inventory base. */
export function unitPriceWithListingDeal(
  baseUnit: number,
  listingPrice: number,
  hasActiveDeal?: boolean,
  originalPrice?: number,
  discountedPrice?: number
): { unit: number; strikeOriginal?: number; hasDeal: boolean } {
  const valid = !!hasActiveDeal && !!originalPrice && discountedPrice != null && listingPrice > 0;
  if (!valid) return { unit: baseUnit, hasDeal: false };
  return {
    unit: baseUnit * (discountedPrice! / listingPrice),
    strikeOriginal: baseUnit * (originalPrice! / listingPrice),
    hasDeal: true,
  };
}
