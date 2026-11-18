import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useRentalCatalogGeoParams } from './useRentalCatalogGeoParams';
import type { RentalListingRow } from './useRentalListings';

export type RentalCatalogSort = 'recommended' | 'relevance' | 'newest' | 'cheapest' | 'expensive';

export interface RentalSearchCatalogHit {
  listing: RentalListingRow;
  available: boolean | null;
  nextAvailableDate: string | null;
  pricePerDay: number;
  totalForDates: number | null;
  dayCount: number | null;
  inspection_enabled?: boolean;
}

export interface RentalCatalogCategory {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

export function useRentalSearchCatalog(options: {
  sort?: RentalCatalogSort;
  q?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { sort = 'recommended', q, categoryId, startDate, endDate } = options;
  const api = useApiClient();
  const geo = useRentalCatalogGeoParams();
  const [hits, setHits] = useState<RentalSearchCatalogHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!geo.ready) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const { data } = await api.get<{
          success: boolean;
          data: { listings: RentalSearchCatalogHit[]; total: number };
        }>('/rentals/search', {
          signal: controller.signal,
          params: catalogParams(geo, nextPage, sort, q, categoryId, startDate, endDate),
        });
        if (controller.signal.aborted) return;
        if (!data.success) {
          if (!append) setHits([]);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        const rows = data.data.listings ?? [];
        setTotal(data.data.total ?? rows.length);
        setPage(nextPage);
        setHits((prev) => (append ? [...prev, ...rows] : rows));
        setLoading(false);
        setLoadingMore(false);
      } catch {
        if (controller.signal.aborted) return;
        if (!append) setHits([]);
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, categoryId, endDate, geo, q, sort, startDate]
  );

  useEffect(() => {
    if (!geo.ready) return undefined;
    void runFetch(1, false);
    return () => abortRef.current?.abort();
  }, [geo.ready, runFetch]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || hits.length >= total) return;
    void runFetch(page + 1, true);
  }, [hits.length, loading, loadingMore, page, runFetch, total]);

  return { hits, total, loading: !geo.ready || loading, loadingMore, loadMore, ready: geo.ready };
}

function catalogParams(
  geo: { country_code?: string; state?: string },
  page: number,
  sort: RentalCatalogSort,
  q: string | undefined,
  categoryId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined
) {
  return {
    page,
    limit: PAGE_SIZE,
    sort,
    q: q?.trim() || undefined,
    category_id: categoryId || undefined,
    country_code: geo.country_code,
    state: geo.state,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };
}

export function useTopRentalCategories() {
  const api = useApiClient();
  const geo = useRentalCatalogGeoParams();
  const [categories, setCategories] = useState<RentalCatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!geo.ready) return undefined;
    const controller = new AbortController();
    setLoading(true);
    void api
      .get<{ success: boolean; data: { categories: RentalCatalogCategory[] } }>('/rentals/categories/top', {
        signal: controller.signal,
        params: { country_code: geo.country_code, state: geo.state, limit: 8 },
      })
      .then((res) => {
        if (!controller.signal.aborted) setCategories(res.data.data?.categories ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategories([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, geo.country_code, geo.ready, geo.state]);

  return { categories, loading };
}
