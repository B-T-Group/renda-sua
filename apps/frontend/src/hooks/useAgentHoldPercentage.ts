import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

interface HoldPercentageResponse {
  holdPercentage: number;
}

export interface UseAgentHoldPercentageReturn {
  holdPercentage: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch the current agent's hold percentage from the API
 */
export const useAgentHoldPercentage = (): UseAgentHoldPercentageReturn => {
  const [holdPercentage, setHoldPercentage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchHoldPercentage = useCallback(async () => {
    if (!apiClient) {
      setError('API client not available');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<HoldPercentageResponse>(
        '/agents/hold-percentage'
      );
      setHoldPercentage(response.data.holdPercentage);
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { error?: string }; status?: number };
        message?: string;
      };
      if (e.response?.status === 403) {
        setError('Only agents can access hold percentage');
      } else {
        setError(
          e.response?.data?.error || e.message || 'Failed to fetch hold percentage'
        );
      }
      setHoldPercentage(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchHoldPercentage();
  }, [fetchHoldPercentage]);

  return { holdPercentage, loading, error, refetch: fetchHoldPercentage };
};
