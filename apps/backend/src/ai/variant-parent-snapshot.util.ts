const MAX_VARIANT_VISION_IMAGES = 8;

/** Dedupes and caps vision image IDs so Bedrock is never sent a duplicate set. */
export function sanitizeVariantImageIds(
  imageIds?: Array<string | null | undefined>
): string[] {
  return [...new Set((imageIds ?? []).filter((id): id is string => Boolean(id)))].slice(
    0,
    MAX_VARIANT_VISION_IMAGES
  );
}

export interface VariantParentItemRow {
  name?: string;
  description?: string;
  sku?: string;
  color?: string;
  weight?: number | null;
  weight_unit?: string | null;
  dimensions?: string | null;
  price?: number;
  currency?: string;
  brand?: { name?: string } | null;
  item_variants?: Array<{ name?: string; sku?: string | null }>;
}

/** Catalog facts the variant vision prompt must inherit from the parent item. */
export function buildVariantParentSnapshot(
  item: VariantParentItemRow
): Record<string, unknown> {
  return {
    locked_price: item.price,
    locked_currency: item.currency,
    name: item.name,
    description: item.description,
    sku: item.sku,
    color: item.color,
    weight: item.weight,
    weight_unit: item.weight_unit,
    dimensions: item.dimensions,
    brand: item.brand?.name ?? null,
    existing_variant_names: (item.item_variants ?? [])
      .map((v) => v.name)
      .filter((n): n is string => typeof n === 'string' && !!n.trim()),
    existing_variant_skus: (item.item_variants ?? [])
      .map((v) => v.sku)
      .filter((s): s is string => typeof s === 'string' && !!s.trim()),
  };
}
