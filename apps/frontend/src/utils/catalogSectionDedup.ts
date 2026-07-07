import type { InventoryItem } from '../hooks/useInventoryItems';

function catalogItemKey(item: InventoryItem): string {
  return item.item_id || item.id;
}

/** Pick up to `limit` items not already in `seen`; mutates `seen`. */
export function pickUniqueCatalogItems(
  items: InventoryItem[],
  seen: Set<string>,
  limit: number
): InventoryItem[] {
  const out: InventoryItem[] = [];
  for (const item of items) {
    const key = catalogItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Filter items whose product key is not in `seen`. */
export function filterExcludedCatalogItems(
  items: InventoryItem[],
  seen: Set<string>
): InventoryItem[] {
  return items.filter((item) => !seen.has(catalogItemKey(item)));
}
