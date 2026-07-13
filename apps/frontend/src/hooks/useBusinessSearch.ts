import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface TransferBusinessOption {
  id: string;
  name: string;
  email: string;
}

export function useBusinessSearch(enabled: boolean, search: string, excludeBusinessId?: string) {
  const apiClient = useApiClient();
  const [options, setOptions] = useState<TransferBusinessOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    if (!enabled || !apiClient || !search.trim()) {
      setOptions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: search.trim() });
      if (excludeBusinessId) params.set('businessId', excludeBusinessId);
      const { data } = await apiClient.get(
        `/business-items/businesses/search?${params.toString()}`
      );
      setOptions(data?.data?.businesses || data?.businesses || []);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? 'Failed to search');
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, search, excludeBusinessId]);

  useEffect(() => {
    if (!enabled) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      void fetchOptions();
    }, 300);
    return () => clearTimeout(timer);
  }, [enabled, fetchOptions]);

  return useMemo(
    () => ({ options, loading, error, refetch: fetchOptions }),
    [options, loading, error, fetchOptions]
  );
}
