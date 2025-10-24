import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState } from 'react';

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
  const { getAccessTokenSilently } = useAuth0();

  const fetchEarnings = useCallback(async () => {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/orders/${orderId}/agent-earnings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch agent earnings');
      }

      const data: AgentEarningsResponse = await response.json();

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
  }, [orderId, getAccessTokenSilently]);

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
