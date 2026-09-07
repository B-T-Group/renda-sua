import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createItemFormCategory,
  createItemFormSubCategory,
  fetchItemFormCategories,
} from '../../services/businessItemFormService';
import { businessApi } from '../../services/businessApi';
import type { ItemFormCategory } from '../../types/business/itemForm';
import type { BusinessCatalogItem } from '../../types/business/items';
import { itemCategoryIds, subsForCategory } from '../../utils/itemCategorySelection';

export type CategoryPickerKind = 'category' | 'subCategory' | null;

function toCategoryError(e: unknown, t: (key: string, fallback: string) => string): string {
  if (e instanceof Error && e.message !== 'update failed') return e.message;
  return t('business.items.categoryUpdateFailed', 'Could not update category');
}

export function useItemCategoryEditor(
  item: BusinessCatalogItem,
  onChanged: () => void,
  onMessage: (text: string) => void
) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<ItemFormCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [picker, setPicker] = useState<CategoryPickerKind>(null);

  const syncFromItem = useCallback(() => {
    const ids = itemCategoryIds(item);
    setCategoryId(ids.categoryId);
    setSubCategoryId(ids.subCategoryId);
  }, [item]);

  useEffect(() => {
    syncFromItem();
  }, [syncFromItem]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const next = await fetchItemFormCategories();
        if (!cancelled) setCategories(next);
      } catch {
        if (!cancelled) {
          onMessage(t('business.items.loadError', 'Failed to load item'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onMessage, t]);

  const subCategories = useMemo(
    () => subsForCategory(categories, categoryId),
    [categories, categoryId]
  );

  const persistSubCategory = useCallback(
    async (id: number) => {
      if (id === item.item_sub_category_id) return;
      setSaving(true);
      try {
        const res = await businessApi.catalog.updateItem(item.id, {
          item_sub_category_id: id,
        });
        if (!res.success) throw new Error('update failed');
        setSubCategoryId(id);
        onMessage(t('business.items.categoryUpdated', 'Category updated'));
        onChanged();
      } catch (e: unknown) {
        onMessage(toCategoryError(e, t));
      } finally {
        setSaving(false);
      }
    },
    [item.id, item.item_sub_category_id, onChanged, onMessage, t]
  );

  const selectCategory = useCallback((id: number) => {
    setCategoryId(id);
    setSubCategoryId(null);
  }, []);

  const selectSubCategory = useCallback(
    (id: number) => {
      void persistSubCategory(id);
    },
    [persistSubCategory]
  );

  const createCategory = useCallback(
    async (name: string) => {
      const created = await createItemFormCategory(name);
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      selectCategory(created.id);
    },
    [selectCategory]
  );

  const createSubCategory = useCallback(
    async (name: string) => {
      if (categoryId == null) return;
      const created = await createItemFormSubCategory(name, categoryId);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, item_sub_categories: [...c.item_sub_categories, created] }
            : c
        )
      );
      await persistSubCategory(created.id);
    },
    [categoryId, persistSubCategory]
  );

  const createFromPicker = useCallback(
    async (kind: CategoryPickerKind, name: string) => {
      try {
        if (kind === 'category') await createCategory(name);
        if (kind === 'subCategory') await createSubCategory(name);
      } catch (e: unknown) {
        onMessage(
          e instanceof Error ? e.message : t('common.error', 'Something went wrong')
        );
      }
    },
    [createCategory, createSubCategory, onMessage, t]
  );

  const needsSubcategory = categoryId != null && subCategoryId == null;

  return {
    categories,
    subCategories,
    categoryId,
    subCategoryId,
    loading,
    saving,
    picker,
    setPicker,
    selectCategory,
    selectSubCategory,
    createFromPicker,
    needsSubcategory,
  };
}
