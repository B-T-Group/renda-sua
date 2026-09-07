import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfileMe } from './useProfileMe';
import { usePermission } from './usePermissions';
import { PlatformPermissions } from '../constants/platformPermissions';
import { fetchAdminBusinesses, applyAdminBusinessReferral } from '../services/adminBusinessesApi';
import type { AdminBusinessListItem } from '../types/adminBusinesses';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function useAdminBusinessesList(options?: {
  /** Default ID document filter (e.g. not_approved for verification queue). */
  initialIdDocumentStatus?: string;
}) {
  const initialIdDocumentStatus = options?.initialIdDocumentStatus ?? '';
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(PlatformPermissions.MANAGE_BUSINESSES, me);

  /** Draft: what the user has typed so far (bound to the input). */
  const [searchDraft, setSearchDraft] = useState('');
  /** Committed: the value actually sent to the API (updated after debounce). */
  const [search, setSearch] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState('');
  const [idDocumentStatus, setIdDocumentStatus] = useState(
    initialIdDocumentStatus
  );
  const [needsAttention, setNeedsAttention] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminBusinessListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When true, the next effect-driven load stays silent (pull-to-refresh). */
  const silentNextLoadRef = useRef(false);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      const seq = ++loadSeqRef.current;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetchAdminBusinesses({
          page,
          limit: PAGE_SIZE,
          search,
          lifecycleStatus: lifecycleStatus || undefined,
          idDocumentStatus: idDocumentStatus || undefined,
          needsAttention: needsAttention || undefined,
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
        setError(e?.message ?? 'Failed to load businesses');
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAccess, page, search, lifecycleStatus, idDocumentStatus, needsAttention]
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

  const commitSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearch(searchDraft.trim());
    setPage(1);
  }, [searchDraft]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    if (page !== 1) {
      silentNextLoadRef.current = true;
      setPage(1);
      return;
    }
    void load({ silent: true });
  }, [load, page]);

  const applyFilter = useCallback(
    (key: 'lifecycle' | 'idDoc' | 'attention', value: string | boolean) => {
      setPage(1);
      if (key === 'lifecycle') setLifecycleStatus(value as string);
      else if (key === 'idDoc') setIdDocumentStatus(value as string);
      else setNeedsAttention(value as boolean);
    },
    []
  );

  const applyReferral = useCallback(
    async (
      id: string,
      code: string,
      referrer?: { name: string; kind: 'agent' | 'business' }
    ) => {
      await applyAdminBusinessReferral(id, code);
      const trimmed = code.trim().toUpperCase();
      setItems((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                referredBy: {
                  kind: referrer?.kind ?? 'agent',
                  name: referrer?.name ?? trimmed,
                  codeUsed: trimmed,
                },
              }
            : b
        )
      );
      void load({ silent: true });
    },
    [load]
  );

  useEffect(() => {
    if (!profileLoading && canAccess) {
      const silent = silentNextLoadRef.current;
      silentNextLoadRef.current = false;
      void load({ silent });
    }
  }, [canAccess, load, profileLoading]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilters = Boolean(
    search ||
      lifecycleStatus ||
      needsAttention ||
      idDocumentStatus !== initialIdDocumentStatus
  );

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
    lifecycleStatus,
    idDocumentStatus,
    needsAttention,
    hasActiveFilters,
    canAccess,
    profileLoading,
    onSearchChange,
    commitSearch,
    setPage,
    applyFilter,
    applyReferral,
    refresh,
    reload: load,
  };
}
