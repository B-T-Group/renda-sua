import { useCallback, useRef, useState } from 'react';
import { businessApi } from '../../services/businessApi';
import type { ImageItemSuggestions } from '../../types/business/items';

export function useImageItemSuggestions() {
  const [suggestions, setSuggestions] = useState<ImageItemSuggestions | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchSuggestions = useCallback(
    async (
      imageIds: string[],
      options?: { hint?: string; isFoodItem?: boolean }
    ) => {
      const ids = imageIds.filter(Boolean);
      if (!ids.length) return null;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await businessApi.ai.imageItemSuggestions(ids, options);
        if (requestId !== requestIdRef.current) return null;
        if (res.success && res.data) {
          setSuggestions(res.data);
          return res.data;
        }
        const message = res.error || 'Failed to get suggestions';
        setError(message);
        return null;
      } catch (e: unknown) {
        if (requestId !== requestIdRef.current) return null;
        const message =
          e instanceof Error ? e.message : 'Failed to get suggestions';
        setError(message);
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setSuggestions(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    reset,
    setSuggestions,
  };
}
