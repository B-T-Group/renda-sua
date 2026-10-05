import { useCallback, useEffect, useRef, useState } from 'react';
import { reaction } from 'mobx';
import { useOrdersApi } from '../../contexts/OrdersApiContext';
import { useStore } from '../../stores/RootStore';
import type { BusinessOrder } from '../../types/business/orders';

export function useBusinessOrderDetail(orderId: string | undefined) {
  const ordersApi = useOrdersApi();
  const { incomingOrder } = useStore();
  const [order, setOrder] = useState<BusinessOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadSuccessfulLoad = useRef(false);

  const fetchOrder = useCallback(async (silent = false) => {
    if (!orderId) {
      hadSuccessfulLoad.current = false;
      setOrder(null);
      setError(null);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await ordersApi.getById(orderId);
      if (res.success && res.order) {
        setOrder(res.order);
        hadSuccessfulLoad.current = true;
      } else if (!silent && !hadSuccessfulLoad.current) {
        setOrder(null);
        setError('Order not found');
      }
    } catch (err: unknown) {
      if (silent || hadSuccessfulLoad.current) return;
      const msg = err instanceof Error ? err.message : 'Failed to load order';
      setError(msg);
      setOrder(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, ordersApi]);

  const applyOrderFromActionResponse = useCallback((res: unknown) => {
    if (!res || typeof res !== 'object') return;
    const next = (res as { order?: BusinessOrder }).order;
    if (next) {
      setOrder(next);
      hadSuccessfulLoad.current = true;
      setError(null);
    }
  }, []);

  useEffect(() => {
    hadSuccessfulLoad.current = false;
    void fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    return reaction(
      () => incomingOrder.liveRevision,
      () => {
        void fetchOrder(true);
      }
    );
  }, [fetchOrder, incomingOrder]);

  return { order, loading, error, refetch: fetchOrder, applyOrderFromActionResponse };
}
