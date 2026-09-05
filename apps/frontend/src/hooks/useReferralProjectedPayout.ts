import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ReferralProjectedPayout {
  payableCount: number;
  amountPerReferral: number;
  projectedAmount: number;
  currency: string;
}

export function useReferralProjectedPayout(
  source: 'agent' | 'business',
  enabled = true
) {
  const apiClient = useApiClient();
  const [projection, setProjection] = useState<ReferralProjectedPayout | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiClient || !enabled) return;
    setLoading(true);
    const path =
      source === 'agent'
        ? '/agents/me/referral-payout-projection'
        : '/businesses/me/referral-payout-projection';
    try {
      const res = await apiClient.get<{
        success: boolean;
        payableCount: number;
        amountPerReferral: number;
        projectedAmount: number;
        currency: string;
      }>(path);
      if (!res.data.success) {
        setProjection(null);
        return;
      }
      setProjection({
        payableCount: res.data.payableCount ?? 0,
        amountPerReferral: res.data.amountPerReferral ?? 0,
        projectedAmount: res.data.projectedAmount ?? 0,
        currency: res.data.currency ?? 'XAF',
      });
    } catch {
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { projection, loading, refresh };
}
