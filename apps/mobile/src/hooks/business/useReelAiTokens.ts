import { useCallback, useEffect, useState } from 'react';
import {
  fetchReelAiTokenBalance,
  fetchReelAiTokenPacks,
  purchaseReelAiTokenPack,
  type ReelAiTokenPackId,
} from '@/services/merchantReelsApi';

export type { ReelAiTokenPackId };

export interface ReelAiTokenPack {
  id: ReelAiTokenPackId;
  tokens: number;
  prices: { CAD: number; XAF: number };
}

export function useReelAiTokens() {
  const [packs, setPacks] = useState<ReelAiTokenPack[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    const next = await fetchReelAiTokenBalance();
    setBalance(next);
    return next;
  }, []);

  const loadPacks = useCallback(async () => {
    setPacks(await fetchReelAiTokenPacks());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadPacks(), refreshBalance()]);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load reel tokens'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPacks, refreshBalance]);

  const purchasePack = useCallback(
    async (params: {
      packId: ReelAiTokenPackId;
      phoneNumber?: string;
      stripePaymentMethod?: 'checkout' | 'payment_sheet';
    }) => purchaseReelAiTokenPack(params),
    []
  );

  return { packs, balance, loading, error, refreshBalance, purchasePack };
}
