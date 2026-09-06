import { useCallback, useEffect, useState } from 'react';
import { businessApi } from '../../services/businessApi';
import type { DashboardAggregates } from '../../types/business/dashboard';

export function useDashboardAggregates(enabled = true) {
  const [data, setData] = useState<DashboardAggregates | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) return;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await businessApi.dashboard.getAggregates();
      if (res.success && res.data) {
        setData(res.data);
      } else if (!options?.silent) {
        setData(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      if (!options?.silent) setData(null);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
