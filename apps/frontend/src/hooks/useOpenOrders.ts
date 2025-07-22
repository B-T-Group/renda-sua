import { useCallback, useEffect, useState } from 'react';
import { Order } from './useAgentOrders';
import { useApiClient } from './useApiClient';

export interface OpenOrdersResponse {
  success: boolean;
  orders: Order[];
  message?: string;
}

export const useOpenOrders = () => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useApiClient();

  const fetchOpenOrders = useCallback(async () => {
    if (!apiClient) {
      setError('API client not available');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<OpenOrdersResponse>('/orders/open');

      if (response.data.success) {
        const orders = response.data.orders;
        setOpenOrders(orders);
        return orders;
      } else {
        setError(response.data.message || 'Failed to fetch open orders');
        setOpenOrders([]);
        return [];
      }
    } catch (err: any) {
      console.error('Error fetching open orders:', err);
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to fetch open orders'
      );
      setOpenOrders([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

  const refetch = useCallback(() => {
    return fetchOpenOrders();
  }, [fetchOpenOrders]);

  return {
    openOrders,
    loading,
    error,
    refetch,
  };
};
