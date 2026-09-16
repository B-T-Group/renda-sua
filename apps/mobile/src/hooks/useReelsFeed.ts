import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchReelsFeed, type FeedReel } from '../services/reelsApi';

const SESSION_KEY = 'reels-feed-session';

function sessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useReelsFeed(country?: string) {
  const [items, setItems] = useState<FeedReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const sessionRef = useRef(sessionId());
  const exhaustedRef = useRef(false);

  const load = useCallback(
    async (reset = false) => {
      if (!reset && exhaustedRef.current) return;
      if (reset) {
        setLoading(true);
        cursorRef.current = null;
        exhaustedRef.current = false;
        sessionRef.current = sessionId();
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
        cursorRef.current = data.nextCursor;
        if (!data.nextCursor) exhaustedRef.current = true;
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load reels');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [country]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || exhaustedRef.current) return;
    void load(false);
  }, [load, loading, loadingMore]);

  const refresh = useCallback(() => load(true), [load]);

  return { items, loading, loadingMore, error, loadMore, refresh, sessionId: sessionRef.current };
}
