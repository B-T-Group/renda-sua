import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformPermissions } from '../constants/platformPermissions';
import { fetchAdminOrders } from '../services/adminOrdersApi';
import type {
  AdminOrderQueue,
  AdminOrderRow,
  AdminOrdersQueueCounts,
} from '../types/adminOrders';
import { usePermission } from './usePermissions';
import { useProfileMe } from './useProfileMe';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_COUNTS: AdminOrdersQueueCounts = {
  total: 0,
  at_risk: 0,
  critical: 0,
  warning: 0,
};

export function useAdminOrdersList() {
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(
    PlatformPermissions.ORDERS_CROSS_BUSINESS,
    me
  );

  const [queue, setQueue] = useState<AdminOrderQueue>('at_risk');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<AdminOrdersQueueCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silentNextLoadRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      const seq = ++loadSeqRef.current;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetchAdminOrders({
          queue,
          search,
          offset: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        if (seq !== loadSeqRef.current) return;
        setOrders(res.orders);
        setTotal(res.total);
        setCounts(res.counts);
      } catch (e: any) {
        if (seq !== loadSeqRef.current) return;
        if (!opts?.silent) {
          setOrders([]);
          setTotal(0);
        }
        setError(e?.message ?? 'Failed to load orders');
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAccess, page, queue, search]
  );

  const onSearchChange = useCallback((text: string) => {
    setSearchDraft(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(text.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const changeQueue = useCallback((next: AdminOrderQueue) => {
    setQueue(next);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    if (page !== 1) {
      silentNextLoadRef.current = true;
      setPage(1);
      return;
    }
    void load({ silent: true });
  }, [load, page]);

  useEffect(() => {
    if (!profileLoading && canAccess) {
      const silent = silentNextLoadRef.current;
      silentNextLoadRef.current = false;
      void load({ silent });
    }
  }, [canAccess, load, profileLoading]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return {
    orders,
    total,
    counts,
    queue,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    loading,
    refreshing,
    error,
    search: searchDraft,
    canAccess,
    profileLoading,
    onSearchChange,
    changeQueue,
    setPage,
    refresh,
    reload: load,
  };
}
