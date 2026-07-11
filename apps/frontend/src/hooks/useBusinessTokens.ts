import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type TokenPackId = 'pack_100' | 'pack_1000' | 'pack_5000';

export interface TokenPack {
  id: TokenPackId;
  tokens: number;
  prices: { CAD: number; XAF: number };
}

export interface TokenPurchaseResult {
  payment_rail: 'stripe' | 'mobile_money';
  payment_method?: 'checkout' | 'payment_sheet';
  paymentUrl?: string;
  checkout_url?: string;
  payment_intent_client_secret?: string;
  paymentPending?: boolean;
  reference?: string;
  tokens: number;
  amount: number;
  currency: string;
}

export function useBusinessTokens() {
  const apiClient = useApiClient();
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    const res = await apiClient.get('/business-tokens/balance');
    const aiTokens = res.data?.data?.ai_tokens;
    setBalance(typeof aiTokens === 'number' ? aiTokens : 0);
    return aiTokens as number;
  }, [apiClient]);

  const loadPacks = useCallback(async () => {
    const res = await apiClient.get('/business-tokens/packs');
    setPacks(res.data?.data ?? []);
  }, [apiClient]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadPacks(), refreshBalance()]);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load AI tokens');
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
    }): Promise<TokenPurchaseResult> => {
      const res = await apiClient.post('/business-tokens/purchase', params);
      return res.data?.data as TokenPurchaseResult;
    },
    [apiClient]
  );

  return {
    packs,
    balance,
    loading,
    error,
    refreshBalance,
    purchasePack,
  };
}
