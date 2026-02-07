import { useCallback, useEffect, useState } from 'react';
import { Order } from './useAgentOrders';
import { useApiClient } from './useApiClient';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useAddressManager } from './useAddressManager';

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
  const { profile } = useUserProfileContext();

  const agentId = profile?.agent?.id;
  const isAgent = !!profile?.agent;

  // Check if agent has addresses (only if user is an agent)
  const { addresses, loading: addressesLoading } = useAddressManager({
    entityType: 'agent',
    entityId: agentId || '',
    autoFetch: isAgent,
  });

  // Update loading state based on address loading
  useEffect(() => {
    if (addressesLoading) {
      setLoading(true);
    }
  }, [addressesLoading]);

  const fetchOpenOrders = useCallback(async () => {
    // If not an agent, don't fetch
    if (!isAgent) {
      setLoading(false);
      setOpenOrders([]);
      return [];
    }

    // Wait for agent ID and address loading to complete
    if (!agentId || addressesLoading) {
      if (!addressesLoading && !agentId) {
        setLoading(false);
      }
      return;
    }

    if (!apiClient) {
      setError('API client not available');
      setLoading(false);
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
  }, [apiClient, agentId, addressesLoading, isAgent]);

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
