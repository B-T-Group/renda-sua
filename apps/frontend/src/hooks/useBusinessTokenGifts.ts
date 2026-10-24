import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type GiftLookup = {
  maskedName: string;
  referralCode: string;
};

export type GiftHistoryItem = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  direction: 'sent' | 'received';
  maskedName: string;
};

export function useBusinessTokenGifts() {
  const apiClient = useApiClient();
  const [giftable, setGiftable] = useState(0);
  const [nongiftable, setNongiftable] = useState(0);
  const [history, setHistory] = useState<GiftHistoryItem[]>([]);

  const refreshBalanceDetails = useCallback(async () => {
    const res = await apiClient.get('/business-tokens/balance');
    const data = res.data?.data;
    setGiftable(typeof data?.giftable === 'number' ? data.giftable : 0);
    setNongiftable(
      typeof data?.ai_tokens_nongiftable === 'number'
        ? data.ai_tokens_nongiftable
        : 0
    );
    return data;
  }, [apiClient]);

  const lookup = useCallback(
    async (code: string): Promise<GiftLookup> => {
      const res = await apiClient.get(
        `/business-tokens/gift-lookup/${encodeURIComponent(code)}`
      );
      return res.data?.data as GiftLookup;
    },
    [apiClient]
  );

  const sendGift = useCallback(
    async (params: {
      code: string;
      amount: number;
      idempotencyKey: string;
    }) => {
      const res = await apiClient.post('/business-tokens/gifts', params);
      return res.data?.data;
    },
    [apiClient]
  );

  const loadHistory = useCallback(async () => {
    const res = await apiClient.get('/business-tokens/gifts');
    const data = res.data?.data;
    const sent = (data?.sent ?? []).map((row: GiftHistoryItem) => ({
      ...row,
      direction: 'sent' as const,
    }));
    const received = (data?.received ?? []).map((row: GiftHistoryItem) => ({
      ...row,
      direction: 'received' as const,
    }));
    const merged = [...sent, ...received].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setHistory(merged);
    return merged;
  }, [apiClient]);

  return {
    giftable,
    nongiftable,
    history,
    refreshBalanceDetails,
    lookup,
    sendGift,
    loadHistory,
  };
}
