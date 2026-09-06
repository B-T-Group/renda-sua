import { useCallback, useRef, useState } from 'react';
import { businessApi } from '@/services/businessApi';
import type { VariantDraft } from '@/components/business/variants/VariantDetailsStep';
import type { VariantSuggestion } from '@/types/business/itemVariant';

type DraftKey = keyof VariantDraft;

function applyVariantSuggestion(
  draft: VariantDraft,
  suggestion: VariantSuggestion,
  locked: ReadonlySet<DraftKey>
): VariantDraft {
  const applyStr = (key: DraftKey, suggested?: string) => {
    if (locked.has(key)) {
      return draft[key];
    }
    const suggestedTrimmed = suggested?.trim();
    if (suggestedTrimmed) {
      return suggestedTrimmed;
    }
    return draft[key];
  };
  const applyNum = (key: DraftKey, suggested?: number) => {
    if (locked.has(key)) {
      return draft[key];
    }
    return suggested != null ? String(suggested) : draft[key];
  };

  return {
    ...draft,
    name: applyStr('name', suggestion.name) as string,
    color: applyStr('color', suggestion.color) as string,
    sku: applyStr('sku', suggestion.sku) as string,
    price: applyNum('price', suggestion.price) as string,
    weight: applyNum('weight', suggestion.weight) as string,
    weightUnit: applyStr('weightUnit', suggestion.weightUnit) as string,
    dimensions: applyStr('dimensions', suggestion.dimensions) as string,
  };
}

export function useVariantAiAutofill() {
  const [loading, setLoading] = useState(false);
  const [filled, setFilled] = useState(false);
  const fetchedRef = useRef(false);
  const sessionRef = useRef(0);
  const lockedFieldsRef = useRef<Set<DraftKey>>(new Set());

  const reset = useCallback(() => {
    sessionRef.current += 1;
    fetchedRef.current = false;
    lockedFieldsRef.current.clear();
    setFilled(false);
    setLoading(false);
  }, []);

  const lockFields = useCallback((keys: DraftKey[]) => {
    keys.forEach((key) => lockedFieldsRef.current.add(key));
  }, []);

  const fetchAndApply = useCallback(
    async (
      itemId: string,
      imageIds: string[],
      onApply: (updater: (current: VariantDraft) => VariantDraft) => void
    ) => {
      const ids = imageIds.filter(Boolean);
      if (!ids.length || fetchedRef.current) return;
      fetchedRef.current = true;
      const session = sessionRef.current;
      setLoading(true);
      try {
        const res = await businessApi.ai.variantSuggestions(itemId, ids);
        if (session !== sessionRef.current) return;
        if (res.success && res.data) {
          const data = res.data;
          const locked = lockedFieldsRef.current;
          onApply((current) => applyVariantSuggestion(current, data, locked));
          setFilled(true);
        }
      } catch {
        // Silent fallback — merchant can use Copy item details
      } finally {
        if (session === sessionRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  return { loading, filled, reset, lockFields, fetchAndApply };
}
