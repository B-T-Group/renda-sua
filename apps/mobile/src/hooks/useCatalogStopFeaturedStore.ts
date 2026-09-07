import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchFeaturedStoreStop,
  type CatalogStopsBaseParams,
} from '../services/catalogStopsApi';
import type { CatalogStore } from '../types/stores';

export interface UseCatalogStopFeaturedStoreOptions {
  countryCode?: string;
  state?: string;
  origin?: { lat: number; lng: number } | null;
  limit?: number;
  enabled?: boolean;
}

export function useCatalogStopFeaturedStore({
  countryCode,
  state,
  origin,
  limit = 8,
  enabled = true,
}: UseCatalogStopFeaturedStoreOptions) {
  const [stores, setStores] = useState<CatalogStore[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setStores([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const params: CatalogStopsBaseParams = {
        country_code: countryCode,
        state,
        limit,
      };

      if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
        params.origin_lat = origin.lat;
        params.origin_lng = origin.lng;
      }

      const envelope = await fetchFeaturedStoreStop(params, { signal: controller.signal });

      if (controller.signal.aborted) return;

      if (envelope.success && envelope.data) {
        setStores(envelope.data.stores ?? []);
      } else {
        setStores([]);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setStores([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [countryCode, state, origin?.lat, origin?.lng, limit, enabled]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStores([]);
      setLoading(false);
      return;
    }

    void load();

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, load]);

  return { stores, loading, refetch: load };
}
