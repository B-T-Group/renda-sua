import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppealDetail,
  AppealQueueCounts,
  AppealQueueQuery,
  AppealQueueResult,
  DecideAppealBody,
} from '../types/itemAppealsAdmin';
import { createItemAppealsAdminApi } from '../services/itemAppealsAdminApi';
import { useApiClient } from './useApiClient';

export function useItemAppealsAdmin() {
  const client = useApiClient();
  const api = useMemo(() => createItemAppealsAdminApi(client), [client]);
  const [queue, setQueue] = useState<AppealQueueResult | null>(null);
  const [counts, setCounts] = useState<AppealQueueCounts | null>(null);
  const [detail, setDetail] = useState<AppealDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(
    async (query?: AppealQueueQuery) => {
      setLoading(true);
      setError(null);
      try {
        const next = await api.list(query);
        setQueue(next);
        return next;
      } catch (err: any) {
        setQueue({ total: 0, appeals: [] });
        setError(err?.message || 'Failed to load appeals');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  const fetchCounts = useCallback(async () => {
    try {
      const next = await api.counts();
      setCounts(next);
      return next;
    } catch {
      return null;
    }
  }, [api]);

  const fetchDetail = useCallback(
    async (appealId: string) => {
      setLoading(true);
      setError(null);
      try {
        const next = await api.detail(appealId);
        setDetail(next);
        return next;
      } catch (err: any) {
        setDetail(null);
        setError(err?.message || 'Failed to load appeal');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  const decide = useCallback(
    (appealId: string, body: DecideAppealBody) => api.decide(appealId, body),
    [api]
  );

  return {
    queue,
    counts,
    detail,
    loading,
    error,
    fetchQueue,
    fetchCounts,
    fetchDetail,
    decide,
    setDetail,
  };
}

export function useItemAppealsCount() {
  const client = useApiClient();
  const api = useMemo(() => createItemAppealsAdminApi(client), [client]);
  const [counts, setCounts] = useState<AppealQueueCounts | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .counts()
      .then((next) => {
        if (!cancelled) setCounts(next);
      })
      .catch(() => {
        if (!cancelled) setCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return counts;
}
