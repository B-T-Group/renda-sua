import { useCallback, useState } from 'react';
import {
  deleteMerchantReel,
  listMerchantReels,
  retryMerchantReel,
  setMerchantReelActive,
  type MerchantReel,
} from '@/services/merchantReelsApi';

export function useMerchantReels(opts?: {
  subjectType?: 'item' | 'rental' | 'business';
  subjectId?: string;
}) {
  const subjectType = opts?.subjectType;
  const subjectId = opts?.subjectId;
  const [reels, setReels] = useState<MerchantReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setReels(await listMerchantReels({ subjectType, subjectId }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load reels');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [subjectId, subjectType]
  );

  const setActive = useCallback(async (reelId: string, isActive: boolean) => {
    setMutatingId(reelId);
    try {
      const updated = await setMerchantReelActive(reelId, isActive);
      setReels((prev) =>
        prev.map((reel) => (reel.id === reelId ? { ...reel, ...updated } : reel))
      );
      return updated;
    } finally {
      setMutatingId(null);
    }
  }, []);

  const retry = useCallback(async (reelId: string) => {
    setMutatingId(reelId);
    try {
      const updated = await retryMerchantReel(reelId);
      setReels((prev) =>
        prev.map((reel) => (reel.id === reelId ? { ...reel, ...updated } : reel))
      );
      return updated;
    } finally {
      setMutatingId(null);
    }
  }, []);

  const remove = useCallback(async (reelId: string) => {
    setMutatingId(reelId);
    try {
      await deleteMerchantReel(reelId);
      setReels((prev) => prev.filter((reel) => reel.id !== reelId));
    } finally {
      setMutatingId(null);
    }
  }, []);

  return {
    reels,
    loading,
    refreshing,
    mutatingId,
    error,
    load,
    setActive,
    retry,
    remove,
  };
}
