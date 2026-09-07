import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { AgentEarningsSummary } from '../types/agent';

export function useAgentEarningsSummary(enabled = true) {
  const [summary, setSummary] = useState<AgentEarningsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.agents.getEarningsSummary();
      if (!res?.success) {
        throw new Error('Failed to fetch earnings summary');
      }
      setSummary({
        todayEarnings: res.todayEarnings,
        currency: res.currency,
        todayDeliveryCount: res.todayDeliveryCount,
        activeOrderCount: res.activeOrderCount,
        recentCommissions: res.recentCommissions ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement gains');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchSummary();
  }, [enabled, fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}
