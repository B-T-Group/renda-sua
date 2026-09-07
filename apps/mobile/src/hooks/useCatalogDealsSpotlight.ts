import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedInventoryItems,
  fetchPublicInventoryItems,
} from '../services/inventoryItemsApi';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

const SPOTLIGHT_LIMIT = 4;

export interface UseCatalogDealsSpotlightOptions {
  /** When false, clears state and does not fetch. */
  enabled: boolean;
  withAuth?: boolean;
  countryCode?: string;
}

export function useCatalogDealsSpotlight({ enabled, withAuth = false, countryCode }: UseCatalogDealsSpotlightOptions) {
  const [items, setItems] = useState<CatalogInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const fetchList = withAuth ? fetchAuthenticatedInventoryItems : fetchPublicInventoryItems;
      const envelope = await fetchList(
        {
          page: 1,
          limit: SPOTLIGHT_LIMIT,
          sort: 'deals',
          is_active: true,
          ...(countryCode && { country_code: countryCode }),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      if (envelope.success) setItems(envelope.data.items.slice(0, SPOTLIGHT_LIMIT));
      else setItems([]);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setItems([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [withAuth, countryCode]);

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
