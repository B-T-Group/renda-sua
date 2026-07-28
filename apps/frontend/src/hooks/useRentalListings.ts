import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';

export type RentalListingsSortMode =
  | 'relevance'
  | 'newest'
  | 'fastest'
  | 'cheapest'
  | 'expensive';

export interface RentalListingRow {
  id: string;
  base_price_per_hour: string | number;
  base_price_per_day: string | number;
  security_deposit_amount?: string | number | null;
  min_rental_hours: number;
  max_rental_hours: number | null;
  units_available?: number;
  pickup_instructions: string;
  dropoff_instructions: string;
  weekly_availability: Array<{
    weekday: number;
    is_available: boolean;
    start_time: string | null;
    end_time: string | null;
  }>;
  updated_at?: string;
  rental_item: {
    id: string;
    name: string;
    description: string;
    tags: string[];
    currency: string;
    operation_mode: string;
    rental_category: { id: string; name: string };
    rental_item_images: Array<{ id: string; image_url: string; alt_text?: string }>;
    business: { id: string; name: string; is_verified?: boolean };
  };
  business_location: {
    id: string;
    name: string;
    address: {
      id?: string;
      address_line_1?: string;
      address_line_2?: string | null;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  distance_text?: string;
  duration_text?: string;
  distance_value?: number;
}

export interface TopRentalLocationRow {
  id: string;
  name: string;
  logo_url: string | null;
  listing_count: number;
  distance_meters: number | null;
  city?: string | null;
  state?: string | null;
}

export interface UseRentalListingsOptions {
  sort?: RentalListingsSortMode;
  q?: string;
  category_id?: string;
  operation_mode?: 'business_operated' | 'take_home' | '';
  origin_lat?: number;
  origin_lng?: number;
  business_location_id?: string;
  enabled?: boolean;
}

const PAGE_SIZE = 25;

export function useRentalListings(options: UseRentalListingsOptions = {}) {
  const {
    sort = 'relevance',
    q,
    category_id,
    operation_mode,
    origin_lat,
    origin_lng,
    business_location_id,
    enabled = true,
  } = options;
  const api = useApiClient();
  const geo = useRentalCatalogGeoParams();
  const [listings, setListings] = useState<RentalListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const catalogReady = geo.ready;

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
        const { data } = await api.get<{
          success: boolean;
          data: {
            listings: RentalListingRow[];
            total: number;
            page: number;
            limit: number;
          };
        }>('/rentals/listings', {
          signal: controller.signal,
          params: {
            page: nextPage,
            limit: PAGE_SIZE,
            sort,
            q: q?.trim() || undefined,
            category_id: category_id || undefined,
            operation_mode: operation_mode || undefined,
            country_code: geo.country_code,
            state: geo.state,
            business_location_id: business_location_id || undefined,
            ...(typeof origin_lat === 'number' ? { origin_lat } : {}),
            ...(typeof origin_lng === 'number' ? { origin_lng } : {}),
          },
        });
        if (controller.signal.aborted) return;
        if (!data.success) {
          if (!append) setListings([]);
          return;
        }
        const rows = data.data.listings ?? [];
        setTotal(data.data.total ?? rows.length);
        setPage(nextPage);
        setListings((prev) => (append ? [...prev, ...rows] : rows));
      } catch (e: unknown) {
        if (controller.signal.aborted) return;
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
      api,
      sort,
      q,
      category_id,
      operation_mode,
      geo.country_code,
      geo.state,
      origin_lat,
      origin_lng,
      business_location_id,
    ]
  );

  useEffect(() => {
    if (!enabled || !catalogReady) {
      if (!catalogReady) setLoading(true);
      return;
    }
    void runFetch(1, false);
    return () => abortRef.current?.abort();
  }, [runFetch, enabled, catalogReady]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || listings.length >= total) return;
    void runFetch(page + 1, true);
  }, [loading, loadingMore, listings.length, total, page, runFetch]);

  const refetch = useCallback(() => runFetch(1, false), [runFetch]);

  return {
    listings,
    loading,
    loadingMore,
    error,
    total,
    loadMore,
    refetch,
    catalogReady,
  };
}

export function useRentalTopLocations(options: {
  enabled?: boolean;
  limit?: number;
  origin_lat?: number;
  origin_lng?: number;
}) {
  const { enabled = true, limit = 8, origin_lat, origin_lng } = options;
  const api = useApiClient();
  const geo = useRentalCatalogGeoParams();
  const [locations, setLocations] = useState<TopRentalLocationRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !geo.ready) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    api
      .get<{
        success: boolean;
        data: { locations: TopRentalLocationRow[] };
      }>('/rentals/top-locations', {
        signal: controller.signal,
        params: {
          limit,
          country_code: geo.country_code,
          state: geo.state,
          ...(typeof origin_lat === 'number' ? { origin_lat } : {}),
          ...(typeof origin_lng === 'number' ? { origin_lng } : {}),
        },
      })
      .then((res) => {
        if (!active || controller.signal.aborted) return;
        setLocations(res.data.data?.locations ?? []);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setLocations([]);
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    api,
    enabled,
    geo.ready,
    geo.country_code,
    geo.state,
    limit,
    origin_lat,
    origin_lng,
  ]);

  return { locations, loading };
}
