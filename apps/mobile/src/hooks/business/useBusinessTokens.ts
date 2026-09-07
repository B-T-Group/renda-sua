import { useCallback, useEffect, useState } from 'react';
import { businessApi } from '@/services/businessApi';

export type TokenPackId = 'pack_100' | 'pack_1000' | 'pack_5000';

export interface TokenPack {
  id: TokenPackId;
  tokens: number;
  prices: { CAD: number; XAF: number };
}

export function useBusinessTokens() {
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    const res = await businessApi.tokens.balance();
    const aiTokens = res.data?.ai_tokens ?? 0;
    setBalance(aiTokens);
    return aiTokens;
  }, []);

  const loadPacks = useCallback(async () => {
    const res = await businessApi.tokens.packs();
    setPacks(res.data ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadPacks(), refreshBalance()]);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tokens');
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
      packId: TokenPackId;
      phoneNumber?: string;
      stripePaymentMethod?: 'checkout' | 'payment_sheet';
    }) => {
      const res = await businessApi.tokens.purchase(params);
      return res.data;
    },
    []
  );

  return { packs, balance, loading, error, refreshBalance, purchasePack };
}
