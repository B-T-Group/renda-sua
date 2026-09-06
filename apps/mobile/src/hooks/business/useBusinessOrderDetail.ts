import { useCallback, useEffect, useRef, useState } from 'react';
import { useOrdersApi } from '../../contexts/OrdersApiContext';
import type { BusinessOrder } from '../../types/business/orders';

export function useBusinessOrderDetail(orderId: string | undefined) {
  const ordersApi = useOrdersApi();
  const [order, setOrder] = useState<BusinessOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadSuccessfulLoad = useRef(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      hadSuccessfulLoad.current = false;
      setOrder(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await ordersApi.getById(orderId);
      if (res.success && res.order) {
        setOrder(res.order);
        hadSuccessfulLoad.current = true;
      } else if (!hadSuccessfulLoad.current) {
        setOrder(null);
        setError('Order not found');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load order';
      if (!hadSuccessfulLoad.current) {
        setError(msg);
        setOrder(null);
      }
    } finally {
      setLoading(false);
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

  return { order, loading, error, refetch: fetchOrder, applyOrderFromActionResponse };
}
