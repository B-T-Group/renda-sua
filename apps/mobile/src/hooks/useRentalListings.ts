import { useCallback, useEffect, useRef, useState } from 'react';
import { getListings } from '../services/rentalsApi';
import { useStore } from '../stores/RootStore';
import type {
  FetchRentalListingsParams,
  RentalListingRow,
  RentalListingsSortMode,
  RentalOperationMode,
} from '../types/rentals';
import type { RentalOrigin } from '../types/rentals';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';

const PAGE_SIZE = 25;

export interface UseRentalListingsOptions {
  sort?: RentalListingsSortMode;
  q?: string;
  category_id?: string;
  min_price?: number;
  max_price?: number;
  operation_mode?: RentalOperationMode;
  origin?: RentalOrigin | null;
  business_location_id?: string;
  /** When false, skip fetching. Defaults to true. */
  enabled?: boolean;
}

export function useRentalListings(options: UseRentalListingsOptions = {}) {
  const {
    sort = 'relevance',
    q,
    category_id,
    min_price,
    max_price,
    operation_mode,
    origin,
    business_location_id,
    enabled = true,
  } = options;
  const { auth } = useStore();
  const geo = useRentalCatalogGeoParams();
  const catalogReady = geo.ready;
  const [listings, setListings] = useState<RentalListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!enabled || !catalogReady) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const params: FetchRentalListingsParams = {
          page: nextPage,
          limit: PAGE_SIZE,
          sort,
          q: q?.trim() || undefined,
          category_id: category_id || undefined,
          min_price,
          max_price,
          operation_mode,
          country_code: geo.country_code,
          state: geo.state,
          business_location_id: business_location_id || undefined,
          ...(origin
            ? { origin_lat: origin.lat, origin_lng: origin.lng }
            : {}),
        };
        const pageData = await getListings(params, {
          withAuth: auth.isAuthenticated,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const tp =
          pageData.limit > 0
            ? Math.ceil(pageData.total / pageData.limit)
            : 0;
        setTotalPages(tp);
        setTotal(pageData.total);
        setPage(nextPage);
        setListings((prev) =>
          append ? [...prev, ...pageData.listings] : pageData.listings
        );
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load rentals');
        if (!append) setListings([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [
      enabled,
      catalogReady,
      sort,
      q,
      category_id,
      min_price,
      max_price,
      operation_mode,
      geo.country_code,
      geo.state,
      origin,
      business_location_id,
      auth.isAuthenticated,
    ]
  );

  useEffect(() => {
    if (!enabled || !catalogReady) {
      abortRef.current?.abort();
      if (!catalogReady) {
        setLoading(true);
      } else {
        setListings([]);
        setLoading(false);
        setLoadingMore(false);
        setPage(1);
        setTotalPages(0);
        setTotal(0);
      }
      return;
    }
    setPage(1);
    void runFetch(1, false);
    return () => {
      abortRef.current?.abort();
    };
  }, [runFetch, enabled, catalogReady]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    void runFetch(page + 1, true);
  }, [loading, loadingMore, page, totalPages, runFetch]);

  const refetch = useCallback(() => runFetch(1, false), [runFetch]);

  return {
    listings,
    loading,
    loadingMore,
    error,
    page,
    totalPages,
    total,
    loadMore,
    refetch,
    catalogReady,
  };
}
