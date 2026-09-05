import { useApiClient } from './useApiClient';
import { useCallback, useEffect, useState } from 'react';

export type PauseDuration = '15m' | '1h' | 'until_tomorrow' | 'indefinite';

export type BusinessReliability = {
  accepting_orders: boolean;
  paused_until: string | null;
  reliability_score?: number;
};

export function useBusinessAvailability(enabled: boolean) {
  const apiClient = useApiClient();
  const [accepting, setAccepting] = useState(true);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiClient || !enabled) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.get<BusinessReliability>(
        '/business/reliability'
      );
      const data = res.data;
      setAccepting(data.accepting_orders !== false);
      setPausedUntil(data.paused_until ?? null);
    } catch {
      // keep last known
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pause = useCallback(
    async (duration: PauseDuration) => {
      if (!apiClient) return;
      setMutating(true);
      try {
        await apiClient.post('/business/availability/pause', { duration });
        setAccepting(false);
        await refresh();
      } finally {
        setMutating(false);
      }
    },
    [apiClient, refresh]
  );

  const resume = useCallback(async () => {
    if (!apiClient) return;
    setMutating(true);
    try {
      await apiClient.post('/business/availability/resume', {});
      setAccepting(true);
      setPausedUntil(null);
      await refresh();
    } finally {
      setMutating(false);
    }
  }, [apiClient, refresh]);

  return {
    accepting,
    pausedUntil,
    loading,
    mutating,
    refresh,
    pause,
    resume,
  };
}
