import { useCallback, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { CreateItemVariantPayload } from './useItemVariants';

export interface VariantSuggestionData {
  name?: string;
  color?: string;
  sku?: string;
  price?: number;
  currency?: string;
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
}

function applySuggestionToForm(
  form: CreateItemVariantPayload,
  suggestion: VariantSuggestionData,
  locked: ReadonlySet<string>
): CreateItemVariantPayload {
  const applyStr = (
    key: string,
    current: string | null | undefined,
    suggested?: string
  ) => {
    if (locked.has(key)) {
      return current;
    }
    const suggestedTrimmed = suggested?.trim();
    if (suggestedTrimmed) {
      return suggestedTrimmed;
    }
    return current;
  };
  const applyNum = (
    key: string,
    current: number | null | undefined,
    suggested?: number
  ) => {
    if (locked.has(key)) {
      return current;
    }
    return suggested ?? current;
  };

  return {
    ...form,
    name: applyStr('name', form.name, suggestion.name) ?? form.name,
    color: applyStr('color', form.color, suggestion.color),
    sku: applyStr('sku', form.sku, suggestion.sku),
    price: applyNum('price', form.price, suggestion.price),
    weight: applyNum('weight', form.weight, suggestion.weight),
    weight_unit:
      applyStr('weight_unit', form.weight_unit, suggestion.weightUnit) ??
      form.weight_unit,
    dimensions: applyStr('dimensions', form.dimensions, suggestion.dimensions),
  };
}

export function useVariantSuggestions() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [filled, setFilled] = useState(false);
  const fetchedRef = useRef(false);
  const sessionRef = useRef(0);
  const lockedFieldsRef = useRef<Set<string>>(new Set());

  const reset = useCallback(() => {
    sessionRef.current += 1;
    fetchedRef.current = false;
    lockedFieldsRef.current.clear();
    setFilled(false);
    setLoading(false);
  }, []);

  const lockFields = useCallback((keys: string[]) => {
    keys.forEach((key) => lockedFieldsRef.current.add(key));
  }, []);

  const fetchAndApply = useCallback(
    async (
      itemId: string,
      imageIds: string[],
      onApply: (
        updater: (current: CreateItemVariantPayload) => CreateItemVariantPayload
      ) => void
    ) => {
      const ids = imageIds.filter(Boolean);
      if (!ids.length || fetchedRef.current) return;
      fetchedRef.current = true;
      const session = sessionRef.current;
      setLoading(true);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: VariantSuggestionData;
          error?: string;
        }>(
          '/ai/variant-suggestions',
          { itemId, imageIds: ids },
          { timeout: 120000 }
        );
        if (session !== sessionRef.current) return;
        if (res.data.success && res.data.data) {
          const data = res.data.data;
          const locked = lockedFieldsRef.current;
          onApply((current) => applySuggestionToForm(current, data, locked));
          setFilled(true);
        }
      } catch {
        // Silent fallback — parent defaults remain
      } finally {
        if (session === sessionRef.current) {
          setLoading(false);
        }
      }
    },
    [apiClient]
  );

  return { loading, filled, reset, lockFields, fetchAndApply };
}
