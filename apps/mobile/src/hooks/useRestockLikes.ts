import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getLikesWithAlerts,
  isRestockDisabledError,
  type RestockLikedItem,
  type RestockLikesFilter,
} from '../services/restockAlertsApi';
import { withAlertEnabled } from '../utils/restockAlertsUi';

const PAGE_SIZE = 20;

export interface UseRestockLikesResult {
  items: RestockLikedItem[];
  filter: RestockLikesFilter;
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  error: string | null;
  appendError: string | null;
  /** Server says restock alerts are off for this market (404 restock_alerts_disabled). */
  unavailable: boolean;
  setFilter: (filter: RestockLikesFilter) => void;
  refresh: () => void;
  loadMore: () => void;
  retryLoadMore: () => void;
  /** Optimistically reflect a successful bell toggle on one card. */
  patchAlert: (itemId: string, enabled: boolean) => void;
  removeItem: (itemId: string) => void;
}

/**
 * Likes with bell state (GET /restock-alerts/likes). Order comes from the
 * server (back in stock, then in stock, then sold out). Latest request wins so a
 * quick filter switch never shows stale rows.
 */
export function useRestockLikes(initialFilter: RestockLikesFilter = 'all'): UseRestockLikesResult {
  const [items, setItems] = useState<RestockLikedItem[]>([]);
  const [filter, setFilterState] = useState<RestockLikesFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appendError, setAppendError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (f: RestockLikesFilter, nextPage: number, replace: boolean) => {
      const id = ++requestId.current;
      if (replace) {
        setError(null);
      } else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      setAppendError(null);
      try {
        const data = await getLikesWithAlerts(f, nextPage, PAGE_SIZE);
        if (id !== requestId.current) return;
        setTotalPages(data.totalPages);
        setPage(data.page);
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
      } catch (e: unknown) {
        if (id !== requestId.current) return;
        if (isRestockDisabledError(e)) {
          setUnavailable(true);
          return;
        }
        const message = e instanceof Error && e.message ? e.message : 'Failed to load liked items';
        if (replace) setError(message);
        else setAppendError(message);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
        if (!replace) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    void fetchPage(filter, 1, true);
  }, [filter, fetchPage]);

  const setFilter = useCallback(
    (next: RestockLikesFilter) => {
      if (next === filter) return;
      setItems([]);
      setPage(1);
      setTotalPages(0);
      setFilterState(next);
    },
    [filter]
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void fetchPage(filter, 1, true);
  }, [filter, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMoreRef.current || page >= totalPages) return;
    void fetchPage(filter, page + 1, false);
  }, [filter, page, totalPages, loading, fetchPage]);

  const retryLoadMore = useCallback(() => {
    void fetchPage(filter, page + 1, false);
  }, [filter, page, fetchPage]);

  const patchAlert = useCallback((itemId: string, enabled: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.item_id === itemId ? withAlertEnabled(i, enabled) : i))
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.item_id !== itemId));
  }, []);

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
    unavailable,
    setFilter,
    refresh,
    loadMore,
    retryLoadMore,
    patchAlert,
    removeItem,
  };
}
