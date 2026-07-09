import { useCallback, useEffect, useRef, useState } from 'react';
import { Order } from './useAgentOrders';
import { useApiClient } from './useApiClient';
import { useUserProfileContext } from '../contexts/UserProfileContext';

export interface OpenOrdersResponse {
  success: boolean;
  orders: Order[];
  canClaim?: boolean;
  previewMode?: 'country' | 'region';
  message?: string;
}

export const useOpenOrders = () => {
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [canClaim, setCanClaim] = useState(false);
  const [previewMode, setPreviewMode] = useState<'country' | 'region' | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useApiClient();
  const { profile } = useUserProfileContext();

  const isAgent = !!profile?.agent;

  const fetchOpenOrders = useCallback(async () => {
    if (!isAgent) {
      setLoading(false);
      setOpenOrders([]);
      setCanClaim(true);
      setPreviewMode(undefined);
      return [];
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
        setCanClaim(response.data.canClaim !== false);
        setPreviewMode(response.data.previewMode);
        return orders;
      }

      setError(response.data.message || 'Failed to fetch open orders');
      setOpenOrders([]);
      return [];
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
  }, [apiClient, isAgent]);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

  const prevVerifiedRef = useRef(profile?.agent?.is_verified);
  useEffect(() => {
    const wasVerified = prevVerifiedRef.current === true;
    const isVerified = profile?.agent?.is_verified === true;
    prevVerifiedRef.current = profile?.agent?.is_verified;
    if (isAgent && isVerified && !wasVerified) {
      void fetchOpenOrders();
    }
  }, [fetchOpenOrders, isAgent, profile?.agent?.is_verified]);

  const refetch = useCallback(() => {
    return fetchOpenOrders();
  }, [fetchOpenOrders]);

  return {
    openOrders,
    canClaim,
    previewMode,
    loading,
    error,
    refetch,
  };
};
