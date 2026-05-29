import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { AdminBusiness } from './useAdminBusinesses';

export interface AdminBusinessOption {
  id: string;
  name: string;
}

export function useAdminBusinessOptions(enabled: boolean, search: string) {
  const apiClient = useApiClient();
  const [options, setOptions] = useState<AdminBusinessOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    if (!enabled || !apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
      });
      if (search.trim()) {
        params.set('search', search.trim());
      }
      const { data } = await apiClient.get(
        `/admin/businesses?${params.toString()}`
      );
      const items: AdminBusiness[] = data.items || data.businesses || [];
      setOptions(
        items.map((b) => ({
          id: b.id,
          name: b.name,
        }))
      );
    } catch (err: unknown) {
      const message =
        (err as { message?: string })?.message ?? 'Failed to load businesses';
      setError(message);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, search]);

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
