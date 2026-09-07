import type { ItemFormCategory, ItemFormSubCategory } from '../types/business/itemForm';

export type ItemCategorySource = {
  item_sub_category_id?: number | null;
  item_sub_category?: {
    id: number;
    item_category?: { id: number } | null;
  } | null;
};

export function itemCategoryIds(item: ItemCategorySource): {
  categoryId: number | null;
  subCategoryId: number | null;
} {
  return {
    categoryId: item.item_sub_category?.item_category?.id ?? null,
    subCategoryId: item.item_sub_category_id ?? item.item_sub_category?.id ?? null,
  };
}

export function subsForCategory(
  categories: ItemFormCategory[],
  categoryId: number | null
): ItemFormSubCategory[] {
  if (categoryId == null) return [];
  return categories.find((c) => c.id === categoryId)?.item_sub_categories ?? [];
}
