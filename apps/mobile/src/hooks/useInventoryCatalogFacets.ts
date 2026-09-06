import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedInventoryItems,
  fetchPublicInventoryItems,
} from '../services/inventoryItemsApi';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import { filterFoodCatalogItems } from '../utils/foodAvailability';

const FACET_LIMIT = 250;

export interface UseInventoryCatalogFacetsOptions {
  countryCode?: string;
  state?: string;
  origin?: { lat: number; lng: number } | null;
  /** When true, facet prefetch uses Bearer + active persona. */
  withAuth?: boolean;
  /** Restrict facet options to cooked food (the Food tab). */
  food_only?: boolean;
  /**
   * When false the hook skips fetching and clears state.
   * Use to defer until prerequisites (e.g. supported-country list) are ready.
   */
  enabled?: boolean;
}

export function useInventoryCatalogFacets({ countryCode, state, origin, withAuth = false, food_only, enabled = true }: UseInventoryCatalogFacetsOptions) {
  const [facetItems, setFacetItems] = useState<CatalogInventoryItem[]>([]);
  const [facetLoading, setFacetLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFacetLoading(true);
    try {
      const fetchList = withAuth ? fetchAuthenticatedInventoryItems : fetchPublicInventoryItems;
      const envelope = await fetchList(
        {
          page: 1,
          limit: FACET_LIMIT,
          sort: 'relevance',
          ...(countryCode && { country_code: countryCode }),
          ...(state?.trim() && { state: state.trim() }),
          ...(origin && { origin_lat: origin.lat, origin_lng: origin.lng }),
          ...(food_only === true && { food_only: true }),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (envelope.success) {
        const rows = envelope.data.items;
        setFacetItems(food_only === true ? filterFoodCatalogItems(rows) : rows);
      } else setFacetItems([]);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setFacetItems([]);
    } finally {
      if (!controller.signal.aborted) setFacetLoading(false);
    }
  }, [countryCode, state, origin?.lat, origin?.lng, withAuth, food_only, enabled]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setFacetItems([]);
      setFacetLoading(false);
      return;
    }
    void load();
    return () => abortRef.current?.abort();
  }, [load, enabled]);

  return { facetItems, facetLoading, refetchFacets: load };
}
