import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';

/**
 * Number of available delivery agents near the current client.
 * Resolves to 0 when disabled, unavailable, or on error.
 */
export function useNearbyAgentsCount(enabled = true) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(enabled);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentApi.clients.getNearbyAgentsCount();
      setCount(res?.count ?? 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      setLoading(false);
      return;
    }
    void fetchCount();
  }, [enabled, fetchCount]);

  return { count, loading };
}
