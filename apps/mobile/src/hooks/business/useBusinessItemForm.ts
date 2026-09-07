import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createItemFormBrand,
  createItemFormCategory,
  createItemFormSubCategory,
  createItemFormTag,
  fetchBusinessItemDetail,
  fetchItemFormBrands,
  fetchItemFormCategories,
  fetchItemFormTags,
  generateItemDescription,
  setBusinessItemTags,
  updateBusinessItemFields,
} from '../../services/businessItemFormService';
import type {
  BusinessItemDetail,
  BusinessItemFormValues,
  ItemFormBrand,
  ItemFormCategory,
  ItemFormTag,
} from '../../types/business/itemForm';
import type { UpdateBusinessItemPayload } from '../../types/business/items';
import { useSupportedCurrencies } from './useSupportedCurrencies';

function itemToFormValues(item: BusinessItemDetail, lockedCurrency?: string | null): BusinessItemFormValues {
  const catId = item.item_sub_category?.item_category?.id ?? null;
  return {
    name: item.name ?? '',
    description: item.description ?? '',
    price: String(item.price ?? 0),
    currency: lockedCurrency || item.currency || 'XAF',
    item_sub_category_id: item.item_sub_category_id ?? item.item_sub_category?.id ?? null,
    categoryId: catId,
    brand_id: item.brand_id ?? item.brand?.id ?? null,
    model: item.model ?? '',
    sku: item.sku ?? '',
    weight: item.weight != null ? String(item.weight) : '',
    weight_unit: item.weight_unit ?? 'g',
    dimensions: item.dimensions ?? '',
    is_fragile: Boolean(item.is_fragile),
    is_perishable: Boolean(item.is_perishable),
    requires_special_handling: Boolean(item.requires_special_handling),
    pay_on_delivery_enabled: Boolean(item.pay_on_delivery_enabled),
    min_order_quantity: String(item.min_order_quantity ?? 1),
    max_order_quantity:
      item.max_order_quantity != null ? String(item.max_order_quantity) : '',
    is_active: item.is_active !== false,
  };
}

function buildPayload(
  values: BusinessItemFormValues,
  lockedCurrency?: string | null
): UpdateBusinessItemPayload {
  const price = Number.parseFloat(values.price) || 0;
  const weight = values.weight.trim() ? Number.parseFloat(values.weight) : null;
  const maxQty = values.max_order_quantity.trim()
    ? Number.parseInt(values.max_order_quantity, 10)
    : null;
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    price,
    currency: lockedCurrency || values.currency,
    item_sub_category_id: values.item_sub_category_id ?? undefined,
    brand_id: values.brand_id,
    model: values.model.trim() || null,
    sku: values.sku.trim() || null,
    weight,
    weight_unit: weight != null ? values.weight_unit : null,
    dimensions: values.dimensions.trim() || null,
    is_fragile: values.is_fragile,
    is_perishable: values.is_perishable,
    requires_special_handling: values.requires_special_handling,
    pay_on_delivery_enabled: values.pay_on_delivery_enabled,
    min_order_quantity: Number.parseInt(values.min_order_quantity, 10) || 1,
    max_order_quantity: maxQty,
    is_active: values.is_active,
  };
}

const EMPTY_FORM: BusinessItemFormValues = {
  name: '',
  description: '',
  price: '0',
  currency: 'XAF',
  item_sub_category_id: null,
  categoryId: null,
  brand_id: null,
  model: '',
  sku: '',
  weight: '',
  weight_unit: 'g',
  dimensions: '',
  is_fragile: false,
  is_perishable: false,
  requires_special_handling: false,
  pay_on_delivery_enabled: false,
  min_order_quantity: '1',
  max_order_quantity: '',
  is_active: true,
};

export function useBusinessItemForm(itemId: string) {
  const { t, i18n } = useTranslation();
  const { defaultCurrency } = useSupportedCurrencies();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<BusinessItemFormValues>(EMPTY_FORM);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<ItemFormCategory[]>([]);
  const [brands, setBrands] = useState<ItemFormBrand[]>([]);
  const [tags, setTags] = useState<ItemFormTag[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [item, cats, brandList, tagList] = await Promise.all([
        fetchBusinessItemDetail(itemId),
        fetchItemFormCategories(),
        fetchItemFormBrands(),
        fetchItemFormTags(),
      ]);
      setValues(itemToFormValues(item, defaultCurrency));
      setSelectedTagIds((item.item_tags ?? []).map((it) => it.tag.id));
      setCategories(cats);
      setBrands(brandList);
      setTags(tagList);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('business.items.loadError', 'Failed to load item'));
    } finally {
      setLoading(false);
    }
  }, [defaultCurrency, itemId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!defaultCurrency) return;
    setValues((prev) =>
      prev.currency === defaultCurrency
        ? prev
        : { ...prev, currency: defaultCurrency }
    );
  }, [defaultCurrency]);

  const patch = useCallback(
    <K extends keyof BusinessItemFormValues>(key: K, value: BusinessItemFormValues[K]) => {
      if (key === 'currency') return;
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const selectedTags = useMemo(
    () => tags.filter((tag) => selectedTagIds.includes(tag.id)),
    [tags, selectedTagIds]
  );

  const subCategories = useMemo(() => {
    if (!values.categoryId) return [];
    return categories.find((c) => c.id === values.categoryId)?.item_sub_categories ?? [];
  }, [categories, values.categoryId]);

  const save = useCallback(async () => {
    if (!values.name.trim()) {
      setError(t('business.items.nameRequired', 'Name is required'));
      return false;
    }
    setSaving(true);
    setError(null);
    try {
      await updateBusinessItemFields(itemId, buildPayload(values, defaultCurrency));
      await setBusinessItemTags(itemId, selectedTagIds);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('business.items.updateError', 'Failed to update item'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [defaultCurrency, itemId, selectedTagIds, t, values]);

  const runAiDescription = useCallback(async () => {
    if (!values.name.trim()) return;
    setAiLoading(true);
    setError(null);
    try {
      const cat = categories.find((c) => c.id === values.categoryId);
      const sub = subCategories.find((s) => s.id === values.item_sub_category_id);
      const brand = brands.find((b) => b.id === values.brand_id);
      const text = await generateItemDescription({
        name: values.name.trim(),
        sku: values.sku.trim() || undefined,
        category: cat?.name,
        subcategory: sub?.name,
        price: Number.parseFloat(values.price) || undefined,
        currency: defaultCurrency || values.currency,
        weight: values.weight.trim() ? Number.parseFloat(values.weight) : undefined,
        weight_unit: values.weight_unit,
        brand: brand?.name,
        language: i18n.language?.startsWith('fr') ? 'fr' : 'en',
      });
      patch('description', text);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : t('business.items.generateError', 'Failed to generate description')
      );
    } finally {
      setAiLoading(false);
    }
  }, [brands, categories, defaultCurrency, i18n.language, patch, subCategories, t, values]);

  const addTagById = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => (prev.includes(tagId) ? prev : [...prev, tagId]));
  }, []);

  const removeTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  }, []);

  const createAndSelectTag = useCallback(
    async (name: string) => {
      const tag = await createItemFormTag(name);
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      addTagById(tag.id);
      return tag;
    },
    [addTagById]
  );

  const createAndSelectBrand = useCallback(
    async (name: string) => {
      const brand = await createItemFormBrand(name);
      setBrands((prev) => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)));
      patch('brand_id', brand.id);
    },
    [patch]
  );

  const createAndSelectCategory = useCallback(
    async (name: string) => {
      const cat = await createItemFormCategory(name);
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      patch('categoryId', cat.id);
      patch('item_sub_category_id', null);
    },
    [patch]
  );

  const createAndSelectSubCategory = useCallback(
    async (name: string, categoryId: number) => {
      const sub = await createItemFormSubCategory(name, categoryId);
      setCategories((prev) =>
        prev.map((c) =>
          c.id === categoryId
            ? { ...c, item_sub_categories: [...c.item_sub_categories, sub] }
            : c
        )
      );
      patch('item_sub_category_id', sub.id);
    },
    [patch]
  );

  return {
    loading,
    saving,
    aiLoading,
    error,
    setError,
    values,
    patch,
    categories,
    brands,
    tags,
    selectedTags,
    selectedTagIds,
    subCategories,
    save,
    runAiDescription,
    addTagById,
    removeTag,
    createAndSelectTag,
    createAndSelectBrand,
    createAndSelectCategory,
    createAndSelectSubCategory,
    reload: load,
  };
}
