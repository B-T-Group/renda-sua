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
  quantity?: number | string | null;
  is_active?: boolean | null;
};

export type PackRebate = {
  saveAmount: number;
  perUnit: number;
  savePercent: number;
};

/** Base units in one sale of this option. Missing or invalid values count as 1. */
export function packQuantityOf(
  source: { quantity?: number | string | null } | null | undefined
): number {
  if (source == null || source.quantity == null || source.quantity === '') {
    return 1;
  }
  const n = Number(source.quantity);
  if (!Number.isFinite(n) || n <= 1) return 1;
  return Math.floor(n);
}

/** Inventory units consumed by one order line (packs × units per pack). */
export function stockUnitsForLine(
  lineQuantity: number,
  packQuantity?: number | null
): number {
  const line = Number(lineQuantity);
  if (!Number.isFinite(line) || line <= 0) return 0;
  return line * packQuantityOf({ quantity: packQuantity ?? 1 });
}

type PackOrderLine = {
  business_inventory_id?: string | null;
  quantity?: number | null;
  item_variant_id?: string | null;
  variant_snapshot?: { quantity?: number | string | null } | null;
};

type PackInventoryRow = {
  id?: string;
  item_variant_id?: string | null;
  item_variant?: { id?: string; quantity?: number | string | null } | null;
  item?: {
    item_variants?: Array<{
      id?: string;
      quantity?: number | string | null;
    }> | null;
  } | null;
};

/** Pack size from the purchase snapshot, else the live catalog variant. */
export function packQuantityForOrderLine(params: {
  line: PackOrderLine;
  inventory?: PackInventoryRow | null;
}): number {
  const snap = params.line.variant_snapshot;
  if (snap != null && snap.quantity != null && snap.quantity !== '') {
    return packQuantityOf(snap);
  }
  const requested = params.line.item_variant_id?.trim() || '';
  const rowId = params.inventory?.item_variant_id;
  if (rowId) return packQuantityOf(params.inventory?.item_variant);
  if (!requested) return 1;
  const match = (params.inventory?.item?.item_variants ?? []).find(
    (v) => v?.id === requested
  );
  return packQuantityOf(match);
}

/** Sum base units per inventory id. One pack of 10 plus 3 singles is 13. */
export function sumStockUnitsByInventory(
  lines: PackOrderLine[],
  inventories?: PackInventoryRow[] | Map<string, PackInventoryRow> | null
): Map<string, number> {
  const lookup = resolveInventoryLookup(inventories);
  const totals = new Map<string, number>();
  for (const line of lines) {
    addLineStock(totals, line, lookup);
  }
  return totals;
}

function resolveInventoryLookup(
  inventories?: PackInventoryRow[] | Map<string, PackInventoryRow> | null
): Map<string, PackInventoryRow> | null {
  if (!inventories) return null;
  if (inventories instanceof Map) return inventories;
  return new Map(
    inventories.filter((row) => row.id).map((row) => [row.id as string, row])
  );
}

function addLineStock(
  totals: Map<string, number>,
  line: PackOrderLine,
  lookup: Map<string, PackInventoryRow> | null
): void {
  const id = line.business_inventory_id;
  if (!id || !line.quantity) return;
  const pack = packQuantityForOrderLine({
    line,
    inventory: lookup?.get(id),
  });
  const units = stockUnitsForLine(line.quantity, pack);
  totals.set(id, (totals.get(id) ?? 0) + units);
}

/**
 * Savings versus buying the same number of singles.
 * Hidden when the option is a single unit or is not cheaper.
 */
export function packRebate(params: {
  packQuantity?: number | null;
  packPrice: number;
  baseUnitPrice: number;
}): PackRebate | null {
  const qty = packQuantityOf({ quantity: params.packQuantity ?? 1 });
  if (qty <= 1) return null;
  if (!(params.baseUnitPrice > 0) || !(params.packPrice >= 0)) return null;
  const singles = params.baseUnitPrice * qty;
  if (!(params.packPrice < singles)) return null;
  const saveAmount = singles - params.packPrice;
  return {
    saveAmount,
    perUnit: params.packPrice / qty,
    savePercent: (saveAmount / singles) * 100,
  };
}

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
