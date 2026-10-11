import { useState, useCallback, useRef } from 'react';
import {
  getLikesWithAlerts,
  type LikedItemWithAlert,
} from '../services/restockAlertsApi';

export type RestockLikesFilter = 'all' | 'back_in_stock';

export interface UseRestockLikesResult {
  items: LikedItemWithAlert[];
  filter: RestockLikesFilter;
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  appendError: string | null;
  load: (nextPage: number, replace: boolean) => Promise<void>;
  setFilter: (filter: RestockLikesFilter) => void;
  refresh: () => void;
}

export function useRestockLikes(): UseRestockLikesResult {
  const [items, setItems] = useState<LikedItemWithAlert[]>([]);
  const [filter, setFilterState] = useState<RestockLikesFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!replace && loadingMoreRef.current) return;

      if (!replace) {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        if (replace) setError(null);
        setAppendError(null);
        const data = await getLikesWithAlerts(filter, nextPage, 20);
        setTotalPages(data.total_pages);
        setPage(data.page);
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      } catch (e: any) {
        const message = e?.message || 'Failed to load liked items';
        if (replace) setError(message);
        else setAppendError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        if (!replace) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [filter]
  );

  const setFilter = useCallback(
    (newFilter: RestockLikesFilter) => {
      if (newFilter === filter) return;
      setFilterState(newFilter);
      setItems([]);
      setPage(1);
      setTotalPages(0);
      void load(1, true);
    },
    [filter, load]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load(1, true);
  }, [load]);

  return {
    items,
    filter,
    page,
    totalPages,
    loading,
    loadingMore,
    refreshing,
    error,
    appendError,
    load,
    setFilter,
    refresh,
  };
}
