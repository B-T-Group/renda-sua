import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type LateReferralStatus = {
  canEnter: boolean;
  locked: boolean;
  expired: boolean;
  maskedReferrerName: string | null;
  accountCreatedAt: string;
  windowEndsAt: string;
};

export function useLateReferral() {
  const apiClient = useApiClient();
  const [status, setStatus] = useState<LateReferralStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/referrals/late/status');
      setStatus(res.data?.data ?? null);
      return res.data?.data as LateReferralStatus;
    } catch (err: any) {
      setError(err?.message || 'Failed to load referral status');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lookup = useCallback(
    async (code: string) => {
      const res = await apiClient.get(
        `/referrals/late/lookup/${encodeURIComponent(code)}`
      );
      return res.data?.data as { maskedName: string };
    },
    [apiClient]
  );

  const apply = useCallback(
    async (code: string) => {
      const res = await apiClient.post('/referrals/late', { code });
      await refresh();
      return res.data?.data as { maskedName: string };
    },
    [apiClient, refresh]
  );

  return { status, loading, error, refresh, lookup, apply };
}
