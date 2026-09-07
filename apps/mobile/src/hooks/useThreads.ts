import { useCallback, useEffect, useRef, useState } from 'react';
import { threadsApi } from '../services/threadsApi';
import type { ThreadListItem } from '../types/threads';

export function useThreads() {
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await threadsApi.listMyThreads();
      if (mountedRef.current) setThreads(data);
    } catch (e: any) {
      if (mountedRef.current) setError(e?.message ?? 'Failed to load conversations');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  return { threads, loading, refreshing, error, refresh, reload: load };
}
