import type { BusinessCatalogItem, BusinessInventoryRow } from '../types/business/items';

/** Inventories from API (`business_inventories`). */
export function getItemInventories(item: BusinessCatalogItem): BusinessInventoryRow[] {
  return item.business_inventories ?? [];
}

export function itemLocationCount(item: BusinessCatalogItem): number {
  return getItemInventories(item).length;
}

export function itemThumbUrl(item: BusinessCatalogItem): string | null {
  const imgs = item.item_images;
  if (!imgs?.length) return null;
  const main = imgs.find((i) => i.image_type === 'main');
  const best = main ?? imgs[0];
  return (best?.display_url ?? best?.image_url)?.trim() || null;
}

export function itemIsOutOfStock(item: BusinessCatalogItem): boolean {
  const inv = getItemInventories(item);
  if (!inv.length) return true;
  return inv.every((r) => {
    const avail = r.computed_available_quantity ?? r.quantity - (r.reserved_quantity ?? 0);
    return avail <= 0;
  });
}

export function itemHasLowStock(item: BusinessCatalogItem): boolean {
  if (itemIsOutOfStock(item)) return false;
  return getItemInventories(item).some((r) => {
    const avail = r.computed_available_quantity ?? r.quantity - (r.reserved_quantity ?? 0);
    const threshold = r.reorder_point ?? 5;
    return avail > 0 && avail <= threshold;
  });
}

export function normalizeCatalogItem(raw: BusinessCatalogItem): BusinessCatalogItem {
  const inventories =
    raw.business_inventories ??
    (raw as BusinessCatalogItem & { business_inventory?: BusinessInventoryRow[] }).business_inventory ??
    [];
  return { ...raw, business_inventories: inventories };
}

export function normalizePageDataItems(items: BusinessCatalogItem[]): BusinessCatalogItem[] {
  return items.map(normalizeCatalogItem);
}
