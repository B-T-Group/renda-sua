import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchDealsStop,
  type CatalogStopsBaseParams,
} from '../services/catalogStopsApi';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

export interface UseCatalogStopDealsOptions {
  countryCode?: string;
  state?: string;
  origin?: { lat: number; lng: number } | null;
  limit?: number;
  enabled?: boolean;
}

export function useCatalogStopDeals({
  countryCode,
  state,
  origin,
  limit = 4,
  enabled = true,
}: UseCatalogStopDealsOptions) {
  const [items, setItems] = useState<CatalogInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
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

      const envelope = await fetchDealsStop(params, { signal: controller.signal });

      if (controller.signal.aborted) return;

      if (envelope.success && envelope.data) {
        setItems(envelope.data.items ?? []);
      } else {
        setItems([]);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setItems([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [countryCode, state, origin?.lat, origin?.lng, limit, enabled]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setItems([]);
      setLoading(false);
      return;
    }

    void load();

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, load]);

  return { items, loading, refetch: load };
}
