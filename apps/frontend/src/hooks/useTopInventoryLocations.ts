import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import {
  catalogGeoQueryParams,
  useCatalogGeoParams,
} from './useCatalogGeoParams';
import type { PublicBrowserGeo } from './usePublicBrowserGeo';

export interface TopInventoryLocationRow {
  id: string;
  name: string;
  logo_url: string | null;
  item_count: number;
  distance_meters?: number | null;
}

export function useTopInventoryLocations(options: {
  limit?: number;
  include_unavailable?: boolean;
  anonymousOrigin?: PublicBrowserGeo | null;
}) {
  const catalogGeo = useCatalogGeoParams();
  const api = useApiClient();
  const [locations, setLocations] = useState<TopInventoryLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = options.limit ?? 5;
  const includeUnavailable = options.include_unavailable ?? false;
  const anonymousOrigin = options.anonymousOrigin;

  const fetchTop = useCallback(async () => {
    if (!catalogGeo.ready) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { locations: TopInventoryLocationRow[] };
      }>('/inventory-items/top-locations', {
        params: {
          limit,
          ...catalogGeoQueryParams(catalogGeo),
          include_unavailable: includeUnavailable,
          ...(anonymousOrigin && {
            origin_lat: anonymousOrigin.lat,
            origin_lng: anonymousOrigin.lng,
          }),
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
  }, [
    api,
    catalogGeo.ready,
    catalogGeo.country_code,
    catalogGeo.state,
    limit,
    includeUnavailable,
    anonymousOrigin,
  ]);

  useEffect(() => {
    void fetchTop();
  }, [fetchTop]);

  return { locations, loading, error, refetch: fetchTop };
}
