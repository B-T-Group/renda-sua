import type { BusinessCatalogItem } from '@/types/business/items';

export type ItemIdentitySpecs = {
  weightLabel?: string;
  dimensionsLabel?: string;
};

/** Read-only weight / dimensions labels for item detail identity card. */
export function itemIdentitySpecs(item: BusinessCatalogItem): ItemIdentitySpecs {
  const weight = item.weight != null ? Number(item.weight) : NaN;
  const weightUnit = item.weight_unit?.trim() || '';
  const dimensions = item.dimensions?.trim() || '';
  const out: ItemIdentitySpecs = {};
  if (Number.isFinite(weight) && weight > 0) {
    out.weightLabel = weightUnit ? `${weight} ${weightUnit}` : String(weight);
  }
  if (dimensions) out.dimensionsLabel = dimensions;
  return out;
}
