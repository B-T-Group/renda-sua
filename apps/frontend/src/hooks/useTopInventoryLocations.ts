import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import {
  INVENTORY_ANONYMOUS_COUNTRY_CODES,
} from './useInventoryItems';
import { DETECTED_COUNTRY_STORAGE_KEY } from './useDetectedCountry';

export interface TopInventoryLocationRow {
  id: string;
  name: string;
  logo_url: string | null;
  item_count: number;
}

export function useTopInventoryLocations(options: {
  limit?: number;
  include_unavailable?: boolean;
}) {
  const { isAuthenticated } = useAuth0();
  const api = useApiClient();
  const [locations, setLocations] = useState<TopInventoryLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = options.limit ?? 5;
  const includeUnavailable = options.include_unavailable ?? false;

  const fetchTop = useCallback(async () => {
    setLoading(true);
    setError(null);
    let country_code: string | undefined;
    if (!isAuthenticated) {
      const detected =
        typeof window !== 'undefined'
          ? localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
          : null;
      const code = detected?.toUpperCase();
      if (code && INVENTORY_ANONYMOUS_COUNTRY_CODES.includes(code)) {
        country_code = code;
      }
    }
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { locations: TopInventoryLocationRow[] };
      }>('/inventory-items/top-locations', {
        params: {
          limit,
          ...(country_code && { country_code }),
          include_unavailable: includeUnavailable,
        },
      });
      if (!data.success) {
        setLocations([]);
        return;
      }
      setLocations(data.data?.locations ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load top locations');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [api, isAuthenticated, limit, includeUnavailable]);

  useEffect(() => {
    void fetchTop();
  }, [fetchTop]);

  return { locations, loading, error, refetch: fetchTop };
}
