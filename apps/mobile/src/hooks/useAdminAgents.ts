import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfileMe } from './useProfileMe';
import { usePermission } from './usePermissions';
import { PlatformPermissions } from '../constants/platformPermissions';
import { fetchAdminAgents, updateAdminAgent, applyAdminAgentReferral } from '../services/adminUsersApi';
import type { AdminAgentUser } from '../types/adminUsers';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function useAdminAgents() {
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(PlatformPermissions.MANAGE_AGENTS, me);

  /** Draft: what the user has typed so far (bound to the input). */
  const [searchDraft, setSearchDraft] = useState('');
  /** Committed: the value actually sent to the API (updated after debounce). */
  const [search, setSearch] = useState('');
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminAgentUser[]>([]);
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
        const res = await fetchAdminAgents({
          page: currentPage,
          limit: PAGE_SIZE,
          search,
          unverifiedOnly,
        });
        if (seq !== loadSeqRef.current) return;
        setItems(res.items);
        setTotal(res.total);
      } catch (e: any) {
        if (seq !== loadSeqRef.current) return;
        if (!opts?.silent) {
          setItems([]);
          setTotal(0);
        }
        setError(e?.message ?? 'Failed to load agents');
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAccess, page, search, unverifiedOnly]
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

  const toggleUnverifiedOnly = useCallback((val: boolean) => {
    setUnverifiedOnly(val);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true, resetPage: true });
  }, [load]);

  const patchAgent = useCallback(
    async (agentId: string, patch: { is_verified?: boolean; is_internal?: boolean }) => {
      await updateAdminAgent(agentId, patch);
      setItems((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, ...patch } : a))
      );
    },
    []
  );

  const applyReferral = useCallback(
    async (
      id: string,
      code: string,
      referrer?: { name: string; kind: 'agent' | 'business' }
    ) => {
      await applyAdminAgentReferral(id, code);
      const trimmed = code.trim().toUpperCase();
      setItems((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                referredBy: {
                  kind: referrer?.kind ?? 'agent',
                  name: referrer?.name ?? trimmed,
                  codeUsed: trimmed,
                },
              }
            : a
        )
      );
      void load({ silent: true });
    },
    [load]
  );

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
    unverifiedOnly,
    canAccess,
    profileLoading,
    onSearchChange,
    toggleUnverifiedOnly,
    setPage,
    refresh,
    patchAgent,
    applyReferral,
    reload: load,
  };
}
