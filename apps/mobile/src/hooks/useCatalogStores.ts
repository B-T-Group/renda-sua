import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedCatalogStores,
  fetchPublicCatalogStores,
} from '../services/inventoryItemsApi';
import type { CatalogStore } from '../types/stores';

export interface UseCatalogStoresOptions {
  limit?: number;
  search?: string;
  countryCode?: string;
  state?: string;
  origin?: { lat: number; lng: number } | null;
  withAuth?: boolean;
  enabled?: boolean;
}

export function useCatalogStores({
  limit = 12,
  search = '',
  countryCode,
  state,
  origin,
  withAuth = false,
  enabled = true,
}: UseCatalogStoresOptions) {
  const [stores, setStores] = useState<CatalogStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const fetchList = withAuth
        ? fetchAuthenticatedCatalogStores
        : fetchPublicCatalogStores;
      const envelope = await fetchList(
        {
          limit,
          search: search.trim() || undefined,
          ...(countryCode && { country_code: countryCode }),
          ...(state?.trim() && { state: state.trim() }),
          ...(origin && { origin_lat: origin.lat, origin_lng: origin.lng }),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (!envelope.success) {
        setError(envelope.message || 'Request failed');
        setStores([]);
        return;
      }
      setStores(envelope.data?.stores ?? []);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load stores');
      setStores([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [
    enabled,
    withAuth,
    limit,
    search,
    countryCode,
    state,
    origin?.lat,
    origin?.lng,
  ]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      setStores([]);
      setLoading(false);
      setError(null);
      return;
    }
    void refetch();
    return () => abortRef.current?.abort();
  }, [refetch, enabled]);

  return { stores, loading, error, refetch };
}
