import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type ReliabilityTier =
  | 'ok'
  | 'warn'
  | 'demote'
  | 'restrict'
  | 'suspend';

export interface AdminBusinessReliabilityRow {
  id: string;
  name?: string | null;
  lifecycle_status?: string | null;
  reliability_score?: number | null;
  reliability_tier?: ReliabilityTier | string | null;
  auto_decline_rolling_30d?: number | null;
  orders_accepted_count?: number | null;
  orders_auto_declined_count?: number | null;
  orders_merchant_cancelled_count?: number | null;
  acceptanceRatePct?: number;
  autoDeclineRatePct?: number;
  merchantCancelRatePct?: number;
  averageAcceptanceSeconds?: number | null;
  accepting_orders?: boolean | null;
  paused_until?: string | null;
  user?: {
    id?: string;
    email?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export function useAdminBusinessReliability() {
  const apiClient = useApiClient();
  const [businesses, setBusinesses] = useState<AdminBusinessReliabilityRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<ReliabilityTier | ''>('');
  const [limit, setLimit] = useState(25);

  const fetchReliability = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (tier) params.set('tier', tier);
      const res = await apiClient.get(
        `/admin/businesses/reliability?${params.toString()}`
      );
      setBusinesses(res.data?.businesses ?? []);
    } catch (e: any) {
      setBusinesses([]);
      setError(
        e?.response?.data?.message ||
          e?.message ||
          'Failed to load business reliability'
      );
    } finally {
      setLoading(false);
    }
  }, [apiClient, limit, tier]);

  useEffect(() => {
    void fetchReliability();
  }, [fetchReliability]);

  return {
    businesses,
    loading,
    error,
    tier,
    setTier,
    limit,
    setLimit,
    refresh: fetchReliability,
  };
}
