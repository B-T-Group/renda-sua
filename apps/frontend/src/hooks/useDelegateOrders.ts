import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { Order, OrderFilters } from './useOrders';

interface UseDelegateOrdersOptions {
  enabled?: boolean;
}

interface UseDelegateOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchOrders: (filters?: OrderFilters) => Promise<void>;
  refreshOrders: () => Promise<void>;
  getOrder: (orderId: string) => Promise<Order | null>;
}

/**
 * Location-delegate order list/detail via `/api/delegate/*`.
 * Do not use `useOrders` (owner `/orders`) in delegation context.
 */
export const useDelegateOrders = (
  options?: UseDelegateOrdersOptions
): UseDelegateOrdersReturn => {
  const enabled = options?.enabled !== false;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<OrderFilters | undefined>();
  const apiClient = useApiClient();

  const fetchOrders = useCallback(
    async (filters?: OrderFilters) => {
      setLoading(true);
      setError(null);
      setLastFilters(filters);
      try {
        const queryParams = new URLSearchParams();
        if (filters && Object.keys(filters).length > 0) {
          const cleanFilters = Object.entries(filters).reduce(
            (acc, [key, value]) => {
              if (value !== '' && value !== null && value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, unknown>
          );
          if (Object.keys(cleanFilters).length > 0) {
            queryParams.append('filters', JSON.stringify(cleanFilters));
          }
        }
        const url = queryParams.toString()
          ? `/delegate/orders?${queryParams.toString()}`
          : '/delegate/orders';
        const response = await apiClient.get(url);
        if (response.data.success) {
          setOrders(response.data.orders || []);
        } else {
          setError(response.data.error || 'Failed to fetch orders');
        }
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
            err?.message ||
            'An error occurred while fetching orders'
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const refreshOrders = useCallback(async () => {
    await fetchOrders(lastFilters);
  }, [fetchOrders, lastFilters]);

  const getOrder = useCallback(
    async (orderId: string): Promise<Order | null> => {
      const response = await apiClient.get(`/delegate/orders/${orderId}`);
      if (response.data.success) return response.data.order;
      return null;
    },
    [apiClient]
  );

  useEffect(() => {
    if (enabled) {
      void fetchOrders();
    } else {
      setLoading(false);
    }
  }, [enabled, fetchOrders]);

  return {
    orders,
    loading,
    error,
    fetchOrders,
    refreshOrders,
    getOrder,
  };
};
