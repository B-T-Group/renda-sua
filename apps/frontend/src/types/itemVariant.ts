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
  quantity?: number | null;
  attributes?: Record<string, unknown> | null;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
  item_variant_images?: ItemVariantImage[];
  /** Variant inventory available units at this listing's location. */
  available_quantity?: number | null;
}

export function availableBaseUnitsForSelection(
  parentAvailable: number | null | undefined,
  variant: { available_quantity?: number | null } | null | undefined,
  isBase: boolean
): number | null | undefined {
  if (isBase || variant?.available_quantity == null) return parentAvailable;
  const qty = Number(variant.available_quantity);
  return Number.isFinite(qty) ? qty : parentAvailable;
}

export function selectedAvailableUnits(
  parentAvailable: number | null | undefined,
  variant: { available_quantity?: number | null } | null | undefined,
  isBase: boolean
): number {
  const qty = Number(
    availableBaseUnitsForSelection(parentAvailable, variant, isBase) ?? 0
  );
  return Number.isFinite(qty) ? qty : 0;
}

export function selectionHasPurchasableStock(
  parentAvailable: number | null | undefined,
  variant: { available_quantity?: number | null; quantity?: number | null } | null | undefined,
  isBase: boolean
): boolean {
  const available = selectedAvailableUnits(parentAvailable, variant, isBase);
  const pack = isBase ? 1 : packQuantityOf(variant);
  return available >= pack;
}

export function listingHasSellableStock(
  parentAvailable: number | null | undefined,
  variants?: Array<{
    available_quantity?: number | null;
    quantity?: number | null;
    is_active?: boolean | null;
  }> | null
): boolean {
  if (Number(parentAvailable) > 0) return true;
  return (variants ?? []).some((variant) => optionHasStock(variant));
}

function optionHasStock(variant: {
  available_quantity?: number | null;
  quantity?: number | null;
  is_active?: boolean | null;
}): boolean {
  if (variant.is_active === false) return false;
  const qty = Number(variant.available_quantity);
  if (!Number.isFinite(qty)) return false;
  return qty >= packQuantityOf(variant);
}

/** Per-location price override on a business_inventory row. */
export interface VariantPriceOverride {
  id?: string;
  item_variant_id: string;
  selling_price: number | string | null;
}

export type ListingDealType = 'percentage' | 'fixed';

function hasValidListingDeal(
  active: boolean | undefined,
  listingPrice: number,
  original?: number,
  discounted?: number
): boolean {
  return (
    !!active &&
    typeof original === 'number' &&
    typeof discounted === 'number' &&
    original > 0 &&
    listingPrice > 0
  );
}

function exactDealUnitPrice(
  base: number,
  type?: ListingDealType,
  value?: number
): number | null {
  if (
    type == null ||
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }
  const discounted =
    type === 'percentage' ? base - (base * value) / 100 : base - value;
  return Math.max(0, discounted);
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
  const url = primary?.display_url?.trim() || primary?.image_url?.trim();
  return url || null;
}

/** Ordered gallery for a variant (primary first). Empty when the variant has no photos. */
export function orderedVariantImages(
  variant: ItemVariant | null | undefined
): ItemVariantImage[] {
  const images = variant?.item_variant_images ?? [];
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });
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

/** Base units in one sale of this option. Missing or invalid values count as 1. */
export function packQuantityOf(
  source: { quantity?: number | null } | null | undefined
): number {
  const n = Number(source?.quantity ?? 1);
  if (!Number.isFinite(n) || n <= 1) return 1;
  return Math.floor(n);
}

export interface PackRebate {
  saveAmount: number;
  perUnit: number;
  savePercent: number;
}

/** Savings versus buying the same number of singles. Null when not a cheaper pack. */
export function packRebate(params: {
  packQuantity?: number | null;
  packPrice: number;
  baseUnitPrice: number;
}): PackRebate | null {
  const qty = packQuantityOf({ quantity: params.packQuantity });
  if (qty <= 1 || !(params.baseUnitPrice > 0) || !(params.packPrice >= 0)) {
    return null;
  }
  const singles = params.baseUnitPrice * qty;
  if (!(params.packPrice < singles)) return null;
  const saveAmount = singles - params.packPrice;
  return {
    saveAmount,
    perUnit: params.packPrice / qty,
    savePercent: (saveAmount / singles) * 100,
  };
}

export interface PackSavingsLabel {
  pct: number;
  count: number;
}

type ListingPackParams = {
  variants?: ItemVariant[] | null;
  listingSellingPrice: number;
  overrides?: VariantPriceOverride[] | null;
  hasActiveDeal?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
  discountType?: ListingDealType;
  discountValue?: number;
};

/** Highest pack discount on a listing, rounded to a whole percent. */
export function bestPackSavings(params: ListingPackParams): PackSavingsLabel | null {
  const base = listingBaseUnit(params);
  let best: PackSavingsLabel | null = null;
  for (const variant of params.variants ?? []) {
    const offer = variantPackOffer(variant, params, base);
    if (offer && (!best || offer.pct > best.pct)) best = offer;
  }
  return best;
}

export function listingHasPackRebate(params: ListingPackParams): boolean {
  return bestPackSavings(params) != null;
}

function listingBaseUnit(params: ListingPackParams): number {
  return unitPriceWithListingDeal(
    params.listingSellingPrice,
    params.listingSellingPrice,
    params.hasActiveDeal,
    params.originalPrice,
    params.discountedPrice,
    params.discountType,
    params.discountValue
  ).unit;
}

function variantPackOffer(
  variant: ItemVariant,
  params: ListingPackParams,
  base: number
): PackSavingsLabel | null {
  if (variant.is_active === false) return null;
  const packBase = effectiveVariantUnitPrice(
    variant,
    params.listingSellingPrice,
    params.overrides
  );
  const packPrice = unitPriceWithListingDeal(
    packBase,
    params.listingSellingPrice,
    params.hasActiveDeal,
    params.originalPrice,
    params.discountedPrice,
    params.discountType,
    params.discountValue
  ).unit;
  const rebate = packRebate({
    packQuantity: variant.quantity,
    packPrice,
    baseUnitPrice: base,
  });
  if (!rebate) return null;
  return { pct: Math.round(rebate.savePercent), count: packQuantityOf(variant) };
}

/** Max packs the shopper can add, in line quantity. Undefined when nothing caps it. */
export function lineQuantityCap(params: {
  packQuantity?: number | null;
  maxOrderBaseUnits?: number | null;
  availableBaseUnits?: number | null;
  otherLinesBaseUnits?: number;
}): number | undefined {
  const pack = packQuantityOf({ quantity: params.packQuantity });
  const caps: number[] = [];
  if (params.maxOrderBaseUnits != null && params.maxOrderBaseUnits > 0) {
    caps.push(Math.floor(params.maxOrderBaseUnits / pack));
  }
  if (params.availableBaseUnits != null) {
    const remaining = Math.max(
      0,
      params.availableBaseUnits - (params.otherLinesBaseUnits ?? 0)
    );
    caps.push(Math.floor(remaining / pack));
  }
  if (!caps.length) return undefined;
  return Math.max(0, Math.min(...caps));
}

/** Apply a listing deal to an arbitrary base unit (e.g. variant-priced SKU). */
export function unitPriceWithListingDeal(
  baseUnit: number,
  listingSellingPrice: number,
  hasActiveDeal: boolean | undefined,
  originalPrice?: number,
  discountedPrice?: number,
  discountType?: ListingDealType,
  discountValue?: number
): { unit: number; strikeOriginal?: number; hasDeal: boolean } {
  if (
    !hasValidListingDeal(
      hasActiveDeal,
      listingSellingPrice,
      originalPrice,
      discountedPrice
    )
  ) {
    return { unit: baseUnit, hasDeal: false };
  }
  const original = originalPrice as number;
  const discounted = discountedPrice as number;
  const unit =
    exactDealUnitPrice(baseUnit, discountType, discountValue) ??
    baseUnit * (discounted / listingSellingPrice);
  return {
    unit,
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
