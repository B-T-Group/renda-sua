import type { CatalogInventoryItem } from '../types/inventoryCatalog';

/** Unique filter option lists from a catalog sample (aligned with web ItemsPageFilter). */
export function buildCatalogFilterOptions(items: CatalogInventoryItem[], categoryFilter: string) {
  const categories = Array.from(
    new Set(
      items.map((it) => it.item?.item_sub_category?.item_category?.name).filter(Boolean) as string[]
    )
  ).sort();

  const subcategories = Array.from(
    new Set(
      items
        .filter(
          (it) =>
            !categoryFilter || it.item?.item_sub_category?.item_category?.name === categoryFilter
        )
        .map((it) => it.item?.item_sub_category?.name)
        .filter(Boolean) as string[]
    )
  ).sort();

  const brands = Array.from(
    new Set(items.map((it) => it.item?.brand?.name).filter(Boolean) as string[])
  ).sort();

  const businesses = Array.from(
    new Set(
      items
        .map((it) => it.business_location?.business?.name?.trim())
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => a.localeCompare(b));

  return { categories, subcategories, brands, businesses };
}
