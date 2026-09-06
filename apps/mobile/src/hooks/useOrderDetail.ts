import { useCallback, useEffect, useRef, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { Order, AgentEarnings } from '../types/agent';

export function useOrderDetail(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [earnings, setEarnings] = useState<AgentEarnings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After at least one successful load, refetch errors keep the last order instead of replacing the screen. */
  const hadSuccessfulLoad = useRef(false);

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      hadSuccessfulLoad.current = false;
      setOrder(null);
      setEarnings(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [orderRes, earningsRes] = await Promise.all([
        agentApi.orders.getById(orderId),
        agentApi.orders.getAgentEarnings(orderId).catch(() => null),
      ]);
      setOrder(orderRes);
      setEarnings(earningsRes);
      hadSuccessfulLoad.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement commande';
      if (!hadSuccessfulLoad.current) {
        setError(msg);
        setOrder(null);
        setEarnings(null);
      } else {
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  /** When POST actions return `{ order }`, merge immediately so the detail UI updates even if GET refetch fails. */
  const applyOrderFromActionResponse = useCallback((res: unknown) => {
    if (!res || typeof res !== 'object') return;
    const next = (res as { order?: Order }).order;
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

  return { order, earnings, loading, error, refetch: fetchOrder, applyOrderFromActionResponse };
}
