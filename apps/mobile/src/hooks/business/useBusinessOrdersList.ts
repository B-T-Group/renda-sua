import { useCallback, useEffect, useState } from 'react';
import { reaction } from 'mobx';
import { useOrdersApi } from '../../contexts/OrdersApiContext';
import { useStore } from '../../stores/RootStore';
import type { BusinessOrder, BusinessOrderFilters } from '../../types/business/orders';

export function useBusinessOrdersList(initialFilters?: BusinessOrderFilters) {
  const ordersApi = useOrdersApi();
  const { incomingOrder } = useStore();
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BusinessOrderFilters | undefined>(initialFilters);

  const fetchOrders = useCallback(
    async (nextFilters?: BusinessOrderFilters) => {
      const f = nextFilters ?? filters;
      setLoading(true);
      setError(null);
      try {
        const res = await ordersApi.list(f);
        if (res.success && res.orders) {
          setOrders(res.orders as BusinessOrder[]);
        } else {
          setOrders([]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, ordersApi]
  );

  useEffect(() => {
    void fetchOrders(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + api mode
  }, [ordersApi.mode]);

  useEffect(() => {
    const dispose = reaction(
      () => incomingOrder.ordersRefreshEpoch,
      () => {
        void fetchOrders();
      }
    );
    return dispose;
  }, [incomingOrder, fetchOrders]);

  const applyFilters = useCallback(
    (next: BusinessOrderFilters) => {
      setFilters(next);
      void fetchOrders(next);
    },
    [fetchOrders]
  );

  return {
    orders,
    loading,
    error,
    filters,
    fetchOrders,
    applyFilters,
    refresh: () => fetchOrders(),
  };
}
