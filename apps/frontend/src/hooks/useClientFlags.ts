import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type ClientFlagKey =
  | 'reels_enabled'
  | 'reels_comments_enabled'
  | 'reels_merchant_allowlist_only'
  | 'floating_nav_enabled'
  | 'reorder_v1'
  | 'auth_web_inapp_gates';

export type ClientFlags = Record<ClientFlagKey, boolean>;

const DEFAULT_FLAGS: ClientFlags = {
  reels_enabled: false,
  reels_comments_enabled: false,
  reels_merchant_allowlist_only: false,
  floating_nav_enabled: false,
  reorder_v1: false,
  auth_web_inapp_gates: false,
};

export function useClientFlags() {
  const apiClient = useApiClient();
  const [flags, setFlags] = useState<ClientFlags>(DEFAULT_FLAGS);

  useEffect(() => {
    if (!apiClient) return;
    let cancelled = false;
    void apiClient
      .get<{ success: boolean; data: ClientFlags }>('/app-config/client-flags')
      .then((res) => {
        if (cancelled) return;
        setFlags({ ...DEFAULT_FLAGS, ...(res.data?.data ?? {}) });
      })
      .catch(() => {
        if (!cancelled) setFlags(DEFAULT_FLAGS);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  return { flags };
}

export function useReorderOrder() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);

  const reorder = useCallback(
    async (orderId: string) => {
      if (!apiClient) throw new Error('API client unavailable');
      setLoading(true);
      try {
        const res = await apiClient.post(`/orders/${orderId}/reorder`);
        return res.data;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { reorder, loading };
}
