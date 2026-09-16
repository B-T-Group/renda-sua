import { useCallback, useEffect, useState } from 'react';
import {
  fetchReelComments,
  postReelComment,
  type ReelComment,
} from '../services/reelCommentsApi';

export function useReelComments(reelId: string | null, enabled: boolean) {
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!reelId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      setComments(await fetchReelComments(reelId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [enabled, reelId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (body: string) => {
      if (!reelId) return;
      const row = await postReelComment(reelId, body);
      setComments((prev) => [...prev, row]);
    },
    [reelId]
  );

  return { comments, loading, error, refresh, submit };
}
