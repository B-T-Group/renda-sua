import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { DesignatedDeclineReason, DesignatedMine } from '../utils/designatedFirst';

/** Designated agent first: my early offers + upcoming designated orders, and their actions. */
export function useDesignatedFirst() {
  const api = useApiClient();
  const [data, setData] = useState<DesignatedMine>({ offers: [], upcoming: [] });
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const res = await api.get('/orders/designated/mine');
      setData({ offers: res.data?.offers ?? [], upcoming: res.data?.upcoming ?? [] });
    } catch {
      setData({ offers: [], upcoming: [] });
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const accept = useCallback((orderId: string) => api.post('/orders/offer/accept', { orderId }), [api]);
  const decline = useCallback(
    (orderId: string, reason?: DesignatedDeclineReason) =>
      api.post('/orders/offer/decline', reason ? { orderId, reason } : { orderId }),
    [api]
  );
  const confirm = useCallback((orderId: string) => api.post(`/orders/${orderId}/designated-confirm`), [api]);
  const release = useCallback(
    (orderId: string, reason: DesignatedDeclineReason) => api.post(`/orders/${orderId}/designated-release`, { reason }),
    [api]
  );

  return { ...data, loading, refetch, accept, decline, confirm, release };
}
