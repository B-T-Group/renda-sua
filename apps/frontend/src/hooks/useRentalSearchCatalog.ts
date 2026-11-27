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
  startTime?: string;
  endTime?: string;
}) {
  const { sort = 'recommended', q, categoryId, startDate, endDate, startTime, endTime } = options;
  const api = useApiClient();
  const geo = useRentalCatalogGeoParams();
  const [hits, setHits] = useState<RentalSearchCatalogHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
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
          data: { listings: RentalSearchCatalogHit[]; total: number; hasMore?: boolean };
        }>('/rentals/search', {
          signal: controller.signal,
          params: catalogParams(geo, nextPage, sort, q, categoryId, { startDate, endDate, startTime, endTime }),
        });
        if (controller.signal.aborted) return;
        if (!data.success) {
          if (!append) setHits([]);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
        const rows = data.data.listings ?? [];
        const total = data.data.total ?? rows.length;
        setTotal(total);
        setPage(nextPage);
        let more = false;
        setHits((prev) => {
          const merged = append ? appendCatalogHits(prev, rows) : rows;
          const added = merged.length - (append ? prev.length : 0);
          more = added > 0 && catalogHasMore(data.data, merged.length);
          return merged;
        });
        setHasMore(more);
        setLoading(false);
        setLoadingMore(false);
      } catch {
        if (controller.signal.aborted) return;
        if (!append) setHits([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, categoryId, endDate, endTime, geo, q, sort, startDate, startTime]
  );

  useEffect(() => {
    if (!geo.ready) return undefined;
    void runFetch(1, false);
    return () => abortRef.current?.abort();
  }, [geo.ready, runFetch]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void runFetch(page + 1, true);
  }, [hasMore, loading, loadingMore, page, runFetch]);

  return { hits, total, hasMore, loading: !geo.ready || loading, loadingMore, loadMore, ready: geo.ready };
}

/** Stop when the page is empty, the API says so, or a stale total would otherwise keep paging. */
export function catalogHasMore(
  page: { listings?: readonly unknown[]; hasMore?: boolean; total?: number },
  loaded: number
): boolean {
  if (!page.listings?.length) return false;
  if (page.hasMore === false) return false;
  if (page.hasMore === true) return true;
  return loaded < (page.total ?? 0);
}

export function appendCatalogHits(
  previous: RentalSearchCatalogHit[],
  next: RentalSearchCatalogHit[]
): RentalSearchCatalogHit[] {
  const seen = new Set(previous.map((hit) => hit.listing.id));
  const added: RentalSearchCatalogHit[] = [];
  for (const hit of next) {
    if (seen.has(hit.listing.id)) continue;
    seen.add(hit.listing.id);
    added.push(hit);
  }
  return [...previous, ...added];
}

function catalogParams(
  geo: { country_code?: string; state?: string },
  page: number,
  sort: RentalCatalogSort,
  q: string | undefined,
  categoryId: string | undefined,
  stay: { startDate?: string; endDate?: string; startTime?: string; endTime?: string }
) {
  return {
    page,
    limit: PAGE_SIZE,
    sort,
    q: q?.trim() || undefined,
    category_id: categoryId || undefined,
    country_code: geo.country_code,
    state: geo.state,
    start_date: stay.startDate || undefined,
    end_date: stay.endDate || undefined,
    start_time: stay.startTime || undefined,
    end_time: stay.endTime || undefined,
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
