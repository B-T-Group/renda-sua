import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchReelsFeed, type FeedReel } from '../services/reelsApi';

function newSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useReelsFeed(country?: string) {
  const [items, setItems] = useState<FeedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(newSessionId);
  const cursorRef = useRef<string | null>(null);
  const sessionRef = useRef(sessionId);
  const exhaustedRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const requestRef = useRef(0);

  const load = useCallback(
    async (reset = false) => {
      if (!country) return;
      if (!reset && exhaustedRef.current) return;
      const requestId = reset ? ++requestRef.current : requestRef.current;
      const isPullRefresh = reset && hasLoadedRef.current;
      if (reset) {
        if (isPullRefresh) setRefreshing(true);
        else setLoading(true);
        cursorRef.current = null;
        exhaustedRef.current = false;
        const nextSession = newSessionId();
        sessionRef.current = nextSession;
        setSessionId(nextSession);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const data = await fetchReelsFeed({
          country,
          cursor: reset ? undefined : cursorRef.current ?? undefined,
          limit: 10,
          sessionId: sessionRef.current,
        });
        if (requestId !== requestRef.current) return;
        cursorRef.current = data.nextCursor;
        if (!data.nextCursor) exhaustedRef.current = true;
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
        hasLoadedRef.current = true;
      } catch (e: unknown) {
        if (requestId !== requestRef.current) return;
        setError(e instanceof Error ? e.message : 'Failed to load reels');
      } finally {
        if (requestId !== requestRef.current) return;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [country]
  );

  useEffect(() => {
    if (!country) return;
    setItems([]);
    hasLoadedRef.current = false;
    void load(true);
  }, [country, load]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || refreshing || exhaustedRef.current) return;
    void load(false);
  }, [load, loading, loadingMore, refreshing]);

  const refresh = useCallback(() => load(true), [load]);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    loadMore,
    refresh,
    sessionId,
  };
}
