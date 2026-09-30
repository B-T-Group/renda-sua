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
  overrides?: InventoryVariantPriceOverride[] | null;
  hasActiveDeal?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
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
    params.discountedPrice
  ).unit;
}

function variantPackOffer(
  variant: ItemVariant,
  params: ListingPackParams,
  base: number
): PackSavingsLabel | null {
  if (variant.is_active === false) return null;
  const override = params.overrides?.find((row) => row.item_variant_id === variant.id);
  const packBase = effectiveVariantUnitPrice(variant, params.listingSellingPrice, override);
  const packPrice = unitPriceWithListingDeal(
    packBase,
    params.listingSellingPrice,
    params.hasActiveDeal,
    params.originalPrice,
    params.discountedPrice
  ).unit;
  const rebate = packRebate({
    packQuantity: variant.quantity,
    packPrice,
    baseUnitPrice: base,
  });
  if (!rebate) return null;
  return { pct: Math.round(rebate.savePercent), count: packQuantityOf(variant) };
}

export function orderLineBounds(params: {
  available: number;
  maxOrder?: number | null;
  minOrder?: number | null;
  packQuantity?: number | null;
  ignoresStock: boolean;
  foodSoftMax?: number;
}): { min: number; max: number } {
  const pack = packQuantityOf({ quantity: params.packQuantity });
  if (params.ignoresStock) {
    const merchantMax = params.maxOrder ?? params.foodSoftMax ?? 99;
    return { min: 1, max: Math.max(1, Math.floor(merchantMax / pack)) };
  }
  const min = pack > 1 ? 1 : Math.max(1, params.minOrder ?? 1);
  const stockPacks = Math.floor(Math.max(0, params.available) / pack);
  const orderPacks =
    params.maxOrder != null ? Math.floor(params.maxOrder / pack) : stockPacks;
  if (stockPacks < 1) return { min: 0, max: 0 };
  return { min, max: Math.max(min, Math.min(stockPacks, orderPacks)) };
}

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
