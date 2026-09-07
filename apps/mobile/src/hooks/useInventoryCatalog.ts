import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedInventoryItems,
  fetchPublicInventoryItems,
} from '../services/inventoryItemsApi';
import type { CatalogInventoryItem, InventorySortMode } from '../types/inventoryCatalog';
import { filterFoodCatalogItems } from '../utils/foodAvailability';

const PAGE_SIZE = 25;

export interface UseInventoryCatalogOptions {
  search: string;
  sort: InventorySortMode;
  countryCode?: string;
  state?: string;
  origin?: { lat: number; lng: number } | null;
  category?: string;
  subcategory?: string;
  brand?: string;
  business_name?: string;
  collection?: string;
  business_id?: string;
  business_location_id?: string;
  /** Merchant preview: include unavailable / bypass visibility when owner. */
  owner_preview?: boolean;
  /** Restrict the list to cooked food sold by restaurants (the Food tab). */
  food_only?: boolean;
  /** When true, GET /inventory-items uses Bearer + active persona (client catalog). */
  withAuth?: boolean;
  /**
   * When false the hook skips fetching and returns an empty loading state.
   * Defaults to true. Use to defer the first fetch until prerequisites (e.g.
   * supported-country list) are ready.
   */
  enabled?: boolean;
}

export function useInventoryCatalog({
  search,
  sort,
  countryCode,
  state,
  origin,
  category,
  subcategory,
  brand,
  business_name,
  collection,
  business_id,
  business_location_id,
  owner_preview,
  food_only,
  withAuth = false,
  enabled = true,
}: UseInventoryCatalogOptions) {
  const [items, setItems] = useState<CatalogInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!enabled) return;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const fetchList = withAuth ? fetchAuthenticatedInventoryItems : fetchPublicInventoryItems;
        const envelope = await fetchList(
          {
            page: nextPage,
            limit: PAGE_SIZE,
            search: search.trim() || undefined,
            sort,
            ...(countryCode && { country_code: countryCode }),
            ...(state?.trim() && { state: state.trim() }),
            ...(origin && { origin_lat: origin.lat, origin_lng: origin.lng }),
            ...(category?.trim() && { category: category.trim() }),
            ...(subcategory?.trim() && { subcategory: subcategory.trim() }),
            ...(brand?.trim() && { brand: brand.trim() }),
            ...(business_name?.trim() && { business_name: business_name.trim() }),
            ...(business_id?.trim() && { business_id: business_id.trim() }),
            ...(business_location_id?.trim() && {
              business_location_id: business_location_id.trim(),
            }),
            ...(owner_preview === true && { owner_preview: true }),
            ...(collection?.trim() && { collection: collection.trim() }),
            ...(food_only === true && { food_only: true }),
          },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (!envelope.success) {
          setError(envelope.message || 'Request failed');
          return;
        }
        const { items: chunk, totalPages: tp, total: t } = envelope.data;
        const visible =
          food_only === true ? filterFoodCatalogItems(chunk) : chunk;
        // If the API ignored food_only, do not keep a marketplace-sized total
        // or page in more non-food rows.
        const leakedNonFood = food_only === true && visible.length !== chunk.length;
        setTotalPages(leakedNonFood ? 1 : tp);
        setTotal(leakedNonFood ? visible.length : t);
        setPage(nextPage);
        setItems((prev) => (append ? [...prev, ...visible] : visible));
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        const msg = e instanceof Error ? e.message : 'Failed to load';
        setError(msg);
        if (!append) setItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      search,
      sort,
      countryCode,
      state,
      origin?.lat,
      origin?.lng,
      category,
      subcategory,
      brand,
      business_name,
      business_id,
      business_location_id,
      owner_preview,
      collection,
      food_only,
      withAuth,
      enabled,
    ]
  );

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setItems([]);
      setLoading(false);
      setLoadingMore(false);
      setPage(1);
      setTotalPages(0);
      setTotal(0);
      return;
    }
    setPage(1);
    void runFetch(1, false);
    return () => {
      abortRef.current?.abort();
    };
  }, [runFetch, enabled]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    void runFetch(page + 1, true);
  }, [loading, loadingMore, page, totalPages, runFetch]);

  const refetch = useCallback(() => runFetch(1, false), [runFetch]);

  return { items, loading, loadingMore, error, page, totalPages, total, loadMore, refetch };
}
