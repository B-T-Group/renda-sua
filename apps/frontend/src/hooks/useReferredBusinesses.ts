import { useCallback, useEffect, useState } from 'react';
import type { ReferredBusinessFollowUp } from '../types/referredBusiness';
import { useApiClient } from './useApiClient';

export function useReferredBusinesses(
  source: 'agent' | 'business',
  enabled = true
) {
  const apiClient = useApiClient();
  const [businesses, setBusinesses] = useState<ReferredBusinessFollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!apiClient || !enabled) return;
    setLoading(true);
    setError(null);
    const path =
      source === 'agent'
        ? '/agents/me/referred-businesses'
        : '/businesses/me/referred-businesses';
    try {
      const res = await apiClient.get<{
        success: boolean;
        businesses: ReferredBusinessFollowUp[];
      }>(path);
      if (!res.data.success) {
        throw new Error('Failed to load referred businesses');
      }
      setBusinesses(res.data.businesses ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load referred businesses');
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { businesses, loading, error, refresh };
}
