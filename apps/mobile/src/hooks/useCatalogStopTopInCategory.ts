import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTopInCategoryStop,
  type FetchTopInCategoryParams,
} from '../services/catalogStopsApi';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

export interface UseCatalogStopTopInCategoryOptions {
  category?: string;
  subcategory?: string;
  countryCode?: string;
  state?: string;
  origin?: { lat: number; lng: number } | null;
  limit?: number;
  enabled?: boolean;
}

export function useCatalogStopTopInCategory({
  category,
  subcategory,
  countryCode,
  state,
  origin,
  limit = 6,
  enabled = true,
}: UseCatalogStopTopInCategoryOptions) {
  const [items, setItems] = useState<CatalogInventoryItem[]>([]);
  const [categoryName, setCategoryName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      setCategoryName('');
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const params: FetchTopInCategoryParams = {
        country_code: countryCode,
        state,
        limit,
      };

      // Only include category/subcategory if they're non-empty
      if (category?.trim()) {
        params.category = category.trim();
      }
      if (subcategory?.trim()) {
        params.subcategory = subcategory.trim();
      }

      if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
        params.origin_lat = origin.lat;
        params.origin_lng = origin.lng;
      }

      const envelope = await fetchTopInCategoryStop(params, { signal: controller.signal });

      if (controller.signal.aborted) return;

      if (envelope.success && envelope.data) {
        setItems(envelope.data.items ?? []);
        setCategoryName(envelope.data.category_name ?? '');
      } else {
        setItems([]);
        setCategoryName('');
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setItems([]);
      setCategoryName('');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [category, subcategory, countryCode, state, origin?.lat, origin?.lng, limit, enabled]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setItems([]);
      setCategoryName('');
      setLoading(false);
      return;
    }

    void load();

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, load]);

  return { items, categoryName, loading, refetch: load };
}
