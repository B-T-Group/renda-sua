import { useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';

export type InventorySearchSuggestion =
  | { kind: 'term'; value: string }
  | {
      kind: 'product';
      inventoryId: string;
      title: string;
      imageUrl?: string | null;
      price: number;
      currency: string;
    }
  | { kind: 'category'; value: string }
  | { kind: 'seller'; businessId: string; name: string; logoUrl?: string | null };

export type UseInventorySearchSuggestionsParams = {
  q: string;
  include_unavailable?: boolean;
  is_active?: boolean;
  country_code?: string;
  state?: string;
  business_location_id?: string;
  origin_lat?: number;
  origin_lng?: number;
};

export type UseInventorySearchSuggestionsOptions = {
  enabled?: boolean;
  debounceMs?: number;
};

export const useInventorySearchSuggestions = (
  params: UseInventorySearchSuggestionsParams,
  options: UseInventorySearchSuggestionsOptions = {}
) => {
  const apiClient = useApiClient();
  const { enabled = true, debounceMs = 250 } = options;

  const [suggestions, setSuggestions] = useState<InventorySearchSuggestion[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => params.q.trim(), [params.q]);
  const queryParams = useMemo(() => {
    return {
      q,
      include_unavailable: params.include_unavailable,
      is_active: params.is_active,
      country_code: params.country_code,
      state: params.state,
      business_location_id: params.business_location_id,
      origin_lat: params.origin_lat,
      origin_lng: params.origin_lng,
    };
  }, [
    q,
    params.include_unavailable,
    params.is_active,
    params.country_code,
    params.state,
    params.business_location_id,
    params.origin_lat,
    params.origin_lng,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<{
          success: boolean;
          data?: { suggestions: InventorySearchSuggestion[] };
          message?: string;
          error?: string;
        }>('/inventory-items/search/suggestions', {
          params: queryParams,
          signal: controller.signal,
        });

        if (res.data.success && res.data.data?.suggestions) {
          setSuggestions(res.data.data.suggestions);
        } else {
          setSuggestions([]);
          setError(res.data.error || 'Failed to load search suggestions');
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to load search suggestions'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [apiClient, debounceMs, enabled, q, queryParams]);

  return { suggestions, loading, error };
};

