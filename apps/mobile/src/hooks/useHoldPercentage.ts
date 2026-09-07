import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';

export function useHoldPercentage(enabled = true) {
  const [holdPercentage, setHoldPercentage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHold = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.agents.getHoldPercentage();
      setHoldPercentage(res.holdPercentage ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setHoldPercentage(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchHold();
  }, [enabled, fetchHold]);

  return { holdPercentage, loading, error, refetch: fetchHold };
}
