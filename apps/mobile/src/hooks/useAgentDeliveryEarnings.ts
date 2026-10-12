import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { DeliveryEarnings, DeliveryEarningsPeriod } from '../types/agentDeliveryEarnings';

export function useAgentDeliveryEarnings(period: DeliveryEarningsPeriod) {
  const [earnings, setEarnings] = useState<DeliveryEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedPeriod = useRef<DeliveryEarningsPeriod | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const switching = loadedPeriod.current !== period;
    try {
      setEarnings(await agentApi.agents.getDeliveryEarnings(period));
      loadedPeriod.current = period;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load deliveries';
      setError(message);
      if (switching) setEarnings(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { earnings, loading, error, refetch };
}
