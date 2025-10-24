import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

interface AgentEarnings {
  totalEarnings: number;
  baseDeliveryCommission: number;
  perKmDeliveryCommission: number;
  currency: string;
}

interface AgentEarningsResponse {
  success: boolean;
  earnings: AgentEarnings;
  message: string;
}

interface UseAgentEarningsReturn {
  earnings: AgentEarnings | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useAgentEarnings = (orderId: string): UseAgentEarningsReturn => {
  const [earnings, setEarnings] = useState<AgentEarnings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchEarnings = useCallback(async () => {
    if (!orderId || !apiClient) {
      setError('Order ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/orders/${orderId}/agent-earnings`);
      const data: AgentEarningsResponse = response.data;

      if (data.success) {
        setEarnings(data.earnings);
      } else {
        throw new Error(data.message || 'Failed to calculate agent earnings');
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred while fetching agent earnings';
      setError(errorMessage);
      setEarnings(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchEarnings();
  }, [orderId, fetchEarnings]);

  return {
    earnings,
    loading,
    error,
    refetch: fetchEarnings,
  };
};
