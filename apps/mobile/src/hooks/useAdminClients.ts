import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfileMe } from './useProfileMe';
import { usePermission } from './usePermissions';
import { PlatformPermissions } from '../constants/platformPermissions';
import { fetchAdminClients } from '../services/adminUsersApi';
import type { AdminClientUser } from '../types/adminUsers';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function useAdminClients() {
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(PlatformPermissions.MANAGE_CLIENTS, me);

  /** Draft: what the user has typed so far (bound to the input). */
  const [searchDraft, setSearchDraft] = useState('');
  /** Committed: the value actually sent to the API (updated after debounce). */
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminClientUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean; resetPage?: boolean }) => {
      if (!canAccess) return;
      const currentPage = opts?.resetPage ? 1 : page;
      if (opts?.resetPage) setPage(1);
      const seq = ++loadSeqRef.current;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetchAdminClients({ page: currentPage, limit: PAGE_SIZE, search });
        if (seq !== loadSeqRef.current) return;
        setItems(res.items);
        setTotal(res.total);
      } catch (e: any) {
        if (seq !== loadSeqRef.current) return;
        setItems([]);
        setTotal(0);
        setError(e?.message ?? 'Failed to load clients');
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAccess, page, search]
  );

  /** Update the visible draft immediately; commit to API search after debounce. */
  const onSearchChange = useCallback((text: string) => {
    setSearchDraft(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(text);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true, resetPage: true });
  }, [load]);

  useEffect(() => {
    if (!profileLoading && canAccess) void load();
  }, [canAccess, load, profileLoading]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    items,
    total,
    page,
    totalPages,
    loading,
    refreshing,
    error,
    /** Visible draft value — bind to the TextInput. */
    search: searchDraft,
    canAccess,
    profileLoading,
    onSearchChange,
    setPage,
    refresh,
    reload: load,
  };
}
