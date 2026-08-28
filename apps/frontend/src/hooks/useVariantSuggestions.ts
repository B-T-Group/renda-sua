import { useCallback, useRef, useState } from 'react';
import {
  applySuggestionToForm,
  type VariantSuggestionData,
} from '../utils/applyVariantSuggestion';
import { useApiClient } from './useApiClient';
import type { CreateItemVariantPayload } from './useItemVariants';

export type { VariantSuggestionData };

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
      onApply: (
        updater: (current: CreateItemVariantPayload) => CreateItemVariantPayload
      ) => void
    ) => {
      if (fetchedRef.current) return;
      fetchedRef.current = true;
      const session = sessionRef.current;
      setLoading(true);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: VariantSuggestionData;
          error?: string;
        }>('/ai/variant-suggestions', { itemId }, { timeout: 120000 });
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
