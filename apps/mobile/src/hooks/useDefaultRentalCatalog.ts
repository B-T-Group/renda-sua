import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { searchRentals, type RentalSearchHit } from '../services/rentalSearchApi';
import { catalogHasMore, defaultCatalogParams, mergeSearchHits } from '../utils/rentals/defaultRentalCatalog';
import type { RentalDateRange } from '../utils/rentals/rentalSearchDates';

type CatalogArgs = {
  enabled: boolean;
  ready: boolean;
  active: boolean;
  country?: string;
  state?: string;
  query: string;
  categoryId: string | null;
  dates: RentalDateRange | null;
  sort: string;
};

export function useDefaultRentalCatalog(args: CatalogArgs) {
  const [hits, setHits] = useState<RentalSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(args.enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const generation = useRef(0);
  const pageRef = useRef(1);
  const filterKey = catalogFilterKey(args);

  useEffect(() => {
    if (!args.enabled || !args.ready || !args.active) {
      if (!args.enabled) setLoading(false);
      return undefined;
    }
    return fetchFirstPage(args, generation, pageRef, setHits, setTotal, setHasMore, setLoading);
  }, [args.enabled, args.ready, args.active, filterKey]);

  const loadMore = useCallback(() => {
    if (!args.enabled || loading || loadingMore || !hasMore) return;
    const gen = generation.current;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    void searchRentals(defaultCatalogParams({ ...args, page: next }))
      .then((page) => {
        if (gen !== generation.current) return;
        pageRef.current = next;
        const rows = page.listings ?? [];
        let more = false;
        setHits((prev) => {
          const merged = mergeSearchHits(prev, rows, next);
          more = merged.length > prev.length && catalogHasMore(page, merged.length);
          return merged;
        });
        setHasMore(more);
        setTotal(page.total ?? 0);
      })
      .catch(() => {
        if (gen === generation.current) setHasMore(false);
      })
      .finally(() => {
        if (gen === generation.current) setLoadingMore(false);
      });
  }, [args, hasMore, loading, loadingMore]);

  return {
    hits,
    total,
    loading: args.enabled && loading,
    loadingMore,
    hasMore,
    loadMore,
  };
}

function catalogFilterKey(args: CatalogArgs): string {
  return [
    args.country,
    args.state,
    args.query.trim(),
    args.categoryId,
    args.dates?.startDate,
    args.dates?.endDate,
    args.dates?.startTime,
    args.dates?.endTime,
    args.sort,
  ].join('|');
}

function fetchFirstPage(
  args: CatalogArgs,
  generation: MutableRefObject<number>,
  pageRef: MutableRefObject<number>,
  setHits: (rows: RentalSearchHit[]) => void,
  setTotal: (total: number) => void,
  setHasMore: (hasMore: boolean) => void,
  setLoading: (loading: boolean) => void
) {
  const gen = ++generation.current;
  pageRef.current = 1;
  const ctrl = new AbortController();
  setLoading(true);
  void searchRentals(defaultCatalogParams({ ...args, page: 1 }), { signal: ctrl.signal })
    .then((page) => {
      if (gen !== generation.current) return;
      const rows = page.listings ?? [];
      setHits(rows);
      setTotal(page.total ?? 0);
      setHasMore(catalogHasMore(page, rows.length));
      setLoading(false);
    })
    .catch(() => {
      if (gen !== generation.current) return;
      setHits([]);
      setTotal(0);
      setHasMore(false);
      setLoading(false);
    });
  return () => ctrl.abort();
}
