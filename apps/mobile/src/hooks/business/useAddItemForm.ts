import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchItemFormBrands,
  fetchItemFormCategories,
} from '../../services/businessItemFormService';
import type {
  ItemFormBrand,
  ItemFormCategory,
} from '../../types/business/itemForm';
import type { FormOption } from '../../components/business/item-form/ItemFormOptionDialog';
import { useImageItemSuggestions } from './useImageItemSuggestions';
import { useSupportedCurrencies } from './useSupportedCurrencies';
import { useIsStripeRail } from '../useIsStripeRail';
import { STRIPE_TAX_CODE_GENERAL_TANGIBLE } from './useStripeTaxCodes';

export interface AddItemFormValues {
  name: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  description?: string;
  price?: number;
  currency?: string;
  stripe_tax_code_id?: string;
}

export interface UseAddItemFormResult {
  // Field values
  name: string;
  setName: (v: string) => void;
  categoryName: string;
  setCategoryName: (v: string) => void;
  subCategoryName: string;
  setSubCategoryName: (v: string) => void;
  brandName: string;
  setBrandName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  currency: string;
  stripeTaxCodeId: string;
  setStripeTaxCodeId: (v: string) => void;

  // Category/brand picker data
  categories: ItemFormCategory[];
  brands: ItemFormBrand[];
  categoryOptions: FormOption[];
  subCategoryOptions: FormOption[];
  brandOptions: FormOption[];
  setCategory: (v: string) => void;

  // AI state
  sugLoading: boolean;
  sugError: string | null;
  aiFilled: boolean;

  // Stripe gate
  showTaxCategory: boolean;
  stripeRailLoading: boolean;

  // Per-page validation
  nameComplete: boolean;
  classificationComplete: boolean;
  priceValid: boolean;
  pricingComplete: boolean;

  // Build final form object
  buildForm: () => AddItemFormValues;

  // Default currency
  defaultCurrency: string | null;
}

export function useAddItemForm(imageIds: string[]): UseAddItemFormResult {
  const { isStripeRail, loading: stripeRailLoading, status: stripeRailStatus } =
    useIsStripeRail();
  const showTaxCategory = stripeRailStatus == null || isStripeRail;

  const {
    suggestions,
    loading: sugLoading,
    error: sugError,
    fetchSuggestions,
  } = useImageItemSuggestions();
  const { defaultCurrency } = useSupportedCurrencies();

  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [stripeTaxCodeId, setStripeTaxCodeId] = useState(STRIPE_TAX_CODE_GENERAL_TANGIBLE);
  const [aiFilled, setAiFilled] = useState(false);

  const [categories, setCategories] = useState<ItemFormCategory[]>([]);
  const [brands, setBrands] = useState<ItemFormBrand[]>([]);

  const aiAttemptedKey = useRef<string | null>(null);
  const imagesKey = imageIds.filter(Boolean).join(',');

  // Keep a ref of current field values so the suggestions effect can read
  // them without re-running needlessly.
  const fieldsRef = useRef({ name, categoryName, subCategoryName, brandName, description, price });
  fieldsRef.current = { name, categoryName, subCategoryName, brandName, description, price };

  // Load categories and brands once.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [cats, brandList] = await Promise.all([
          fetchItemFormCategories(),
          fetchItemFormBrands(),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setBrands(brandList);
      } catch {
        // Best-effort; user can still type values manually.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Auto-trigger AI once per unique image set.
  useEffect(() => {
    if (!imagesKey || aiAttemptedKey.current === imagesKey) return;
    aiAttemptedKey.current = imagesKey;
    void fetchSuggestions(imageIds);
  }, [fetchSuggestions, imageIds, imagesKey]);

  // Apply suggestions to empty fields only (no overwrite path needed).
  useEffect(() => {
    if (!suggestions) return;
    const current = fieldsRef.current;
    let applied = false;
    const fill = (existing: string, next?: string | null) => {
      if (!next || existing.trim()) return existing;
      applied = true;
      return next;
    };
    setName(fill(current.name, suggestions.name));
    setCategoryName(fill(current.categoryName, suggestions.categoryName));
    setSubCategoryName(fill(current.subCategoryName, suggestions.subCategoryName));
    setBrandName(fill(current.brandName, suggestions.brandName));
    setDescription(fill(current.description, suggestions.descriptionSuggestion));
    if (suggestions.price != null && !current.price.trim()) {
      setPrice(String(suggestions.price));
      applied = true;
    }
    if (applied) setAiFilled(true);
  }, [suggestions]);

  // Sync default currency once resolved.
  useEffect(() => {
    if (defaultCurrency) setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  const setCategory = useCallback((value: string) => {
    setCategoryName(value);
    setSubCategoryName('');
  }, []);

  // Derived picker options.
  const selectedCategory = useMemo(
    () =>
      categories.find(
        (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
      ) ?? null,
    [categories, categoryName]
  );

  const categoryOptions = useMemo<FormOption[]>(
    () => categories.map((c) => ({ id: c.name, label: c.name })),
    [categories]
  );
  const subCategoryOptions = useMemo<FormOption[]>(
    () =>
      (selectedCategory?.item_sub_categories ?? []).map((s) => ({
        id: s.name,
        label: s.name,
      })),
    [selectedCategory]
  );
  const brandOptions = useMemo<FormOption[]>(
    () => brands.map((b) => ({ id: b.name, label: b.name })),
    [brands]
  );

  // Per-page validation.
  const nameComplete = name.trim() !== '';
  const classificationComplete =
    categoryName.trim() !== '' && subCategoryName.trim() !== '';
  const priceNumber = Number.parseFloat(price);
  const priceValid =
    price.trim() !== '' && !Number.isNaN(priceNumber) && priceNumber > 0;
  const pricingComplete = priceValid;

  const buildForm = useCallback((): AddItemFormValues => ({
    name: name.trim(),
    categoryName: categoryName.trim() || undefined,
    subCategoryName: subCategoryName.trim() || undefined,
    brandName: brandName.trim() || undefined,
    description: description.trim() || undefined,
    price: priceValid ? priceNumber : undefined,
    currency: currency.trim() || 'XAF',
    stripe_tax_code_id: stripeTaxCodeId,
  }), [name, categoryName, subCategoryName, brandName, description, priceValid, priceNumber, currency, stripeTaxCodeId]);

  return {
    name,
    setName,
    categoryName,
    setCategoryName,
    subCategoryName,
    setSubCategoryName,
    brandName,
    setBrandName,
    description,
    setDescription,
    price,
    setPrice,
    currency,
    stripeTaxCodeId,
    setStripeTaxCodeId,
    categories,
    brands,
    categoryOptions,
    subCategoryOptions,
    brandOptions,
    setCategory,
    sugLoading,
    sugError,
    aiFilled,
    showTaxCategory,
    stripeRailLoading,
    nameComplete,
    classificationComplete,
    priceValid,
    pricingComplete,
    buildForm,
    defaultCurrency,
  };
}
