import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RecentCommission {
  orderId: string;
  orderNumber: string;
  amount: number;
  deliveredAt: string | null;
}

export interface AgentEarningsSummary {
  todayEarnings: number;
  currency: string;
  todayDeliveryCount: number;
  activeOrderCount: number;
  recentCommissions: RecentCommission[];
}

interface EarningsSummaryResponse {
  success: boolean;
  todayEarnings: number;
  currency: string;
  todayDeliveryCount: number;
  activeOrderCount: number;
  recentCommissions: RecentCommission[];
}

interface UseAgentEarningsSummaryReturn {
  summary: AgentEarningsSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useAgentEarningsSummary = (
  enabled: boolean = true
): UseAgentEarningsSummaryReturn => {
  const [summary, setSummary] = useState<AgentEarningsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchSummary = useCallback(async () => {
    if (!apiClient || !enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<EarningsSummaryResponse>(
        '/agents/earnings-summary'
      );
      const data = response.data;

      if (data.success) {
        setSummary({
          todayEarnings: data.todayEarnings,
          currency: data.currency,
          todayDeliveryCount: data.todayDeliveryCount,
          activeOrderCount: data.activeOrderCount,
          recentCommissions: data.recentCommissions ?? [],
        });
      } else {
        throw new Error('Failed to fetch earnings summary');
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred while fetching earnings summary';
      setError(errorMessage);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled]);

  useEffect(() => {
    if (enabled) {
      fetchSummary();
    }
  }, [enabled, fetchSummary]);

  return {
    summary,
    loading,
    error,
    refetch: fetchSummary,
  };
};
