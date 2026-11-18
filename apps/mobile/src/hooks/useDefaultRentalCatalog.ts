import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { searchRentals, type RentalSearchHit } from '../services/rentalSearchApi';
import { defaultCatalogParams, mergeSearchHits } from '../utils/rentals/defaultRentalCatalog';
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
  const generation = useRef(0);
  const pageRef = useRef(1);
  const filterKey = catalogFilterKey(args);

  useEffect(() => {
    if (!args.enabled || !args.ready || !args.active) {
      if (!args.enabled) setLoading(false);
      return undefined;
    }
    return fetchFirstPage(args, generation, pageRef, setHits, setTotal, setLoading);
  }, [args.enabled, args.ready, args.active, filterKey]);

  const loadMore = useCallback(() => {
    if (!args.enabled || loading || loadingMore || hits.length >= total) return;
    const gen = generation.current;
    const next = pageRef.current + 1;
    setLoadingMore(true);
    void searchRentals(defaultCatalogParams({ ...args, page: next }))
      .then((page) => {
        if (gen !== generation.current) return;
        pageRef.current = next;
        setHits((prev) => mergeSearchHits(prev, page.listings ?? [], next));
        setTotal(page.total ?? 0);
      })
      .catch(() => undefined)
      .finally(() => {
        if (gen === generation.current) setLoadingMore(false);
      });
  }, [args, hits.length, loading, loadingMore, total]);

  return {
    hits,
    total,
    loading: args.enabled && loading,
    loadingMore,
    hasMore: hits.length < total,
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
    args.sort,
  ].join('|');
}

function fetchFirstPage(
  args: CatalogArgs,
  generation: MutableRefObject<number>,
  pageRef: MutableRefObject<number>,
  setHits: (rows: RentalSearchHit[]) => void,
  setTotal: (total: number) => void,
  setLoading: (loading: boolean) => void
) {
  const gen = ++generation.current;
  pageRef.current = 1;
  const ctrl = new AbortController();
  setLoading(true);
  void searchRentals(defaultCatalogParams({ ...args, page: 1 }), { signal: ctrl.signal })
    .then((page) => {
      if (gen !== generation.current) return;
      setHits(page.listings ?? []);
      setTotal(page.total ?? 0);
      setLoading(false);
    })
    .catch(() => {
      if (gen !== generation.current) return;
      setHits([]);
      setTotal(0);
      setLoading(false);
    });
  return () => ctrl.abort();
}
