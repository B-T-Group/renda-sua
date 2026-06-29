import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

interface NearbyAgentsResponse {
  count: number;
}

/**
 * Loads the number of available delivery agents near the current client.
 * Returns 0 when the user is not a client or has no usable address.
 */
export function useNearbyAgents(enabled = true) {
  const api = useApiClient();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<NearbyAgentsResponse>(
        '/clients/nearby-agents'
      );
      setCount(data?.count ?? 0);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    fetchCount();
  }, [enabled, fetchCount]);

  return { count, loading };
}
