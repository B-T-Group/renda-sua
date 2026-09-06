import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import { useStore } from '../stores/RootStore';
import type { Order } from '../types/agent';
import type { OpenOrdersResponse } from '../types/agent';

export function useOpenOrders() {
  const { ordersSignal } = useStore();
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [canClaim, setCanClaim] = useState(false);
  const [previewMode, setPreviewMode] = useState<'country' | 'region' | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpenOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await agentApi.orders.getOpen()) as OpenOrdersResponse & {
        data?: OpenOrdersResponse;
      };
      const payload = res.data ?? res;
      const list = (payload.orders ?? []) as Order[];
      if (Array.isArray(list)) {
        setOpenOrders(list);
        setCanClaim(payload.canClaim !== false);
        setPreviewMode(payload.previewMode);
        return list;
      }
      setOpenOrders([]);
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement commandes disponibles';
      setError(msg);
      setOpenOrders([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpenOrders();
  }, [fetchOpenOrders]);

  const claimOrder = useCallback(async (orderId: string) => {
    const res = await agentApi.orders.claimOrder(orderId);
    if (!res.success) throw new Error(res.message);
    ordersSignal.notifyStatusChanged();
    await fetchOpenOrders();
    return res;
  }, [fetchOpenOrders, ordersSignal]);

  const claimOrderWithTopup = useCallback(async (orderId: string, phone_number?: string) => {
    const res = await agentApi.orders.claimOrderWithTopup(orderId, phone_number);
    if (!res.success) throw new Error(res.message);
    ordersSignal.notifyStatusChanged();
    await fetchOpenOrders();
    return res;
  }, [fetchOpenOrders, ordersSignal]);

  return {
    openOrders,
    canClaim,
    previewMode,
    loading,
    error,
    refetch: fetchOpenOrders,
    claimOrder,
    claimOrderWithTopup,
  };
}
