import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { FailedDeliveryReason } from '../types/agent';

export function useFailedDeliveryReasons(language: 'fr' | 'en' = 'fr') {
  const [reasons, setReasons] = useState<FailedDeliveryReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReasons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.failedDeliveries.getReasons(language);
      setReasons(res.reasons ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement raisons');
      setReasons([]);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchReasons();
  }, [fetchReasons]);

  return { reasons, loading, error, refetch: fetchReasons };
}
