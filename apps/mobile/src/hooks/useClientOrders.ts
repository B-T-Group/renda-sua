import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { agentApi } from '../services/agentApi';
import type { Order } from '../types/agent';

export type ClientOrderListFilters = Record<string, string>;

export interface ClientOrderStats {
  total: number;
  active: number;
  pending: number;
  delivered: number;
  byStatus: Record<string, number>;
}

function buildFiltersParam(filters: ClientOrderListFilters | undefined): string | undefined {
  if (!filters) return undefined;
  const clean = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  ) as Record<string, string>;
  return Object.keys(clean).length ? JSON.stringify(clean) : undefined;
}

function computeStats(orders: Order[]): ClientOrderStats {
  const nonCancelled = orders.filter((o) => o.current_status !== 'cancelled');
  const byStatus: Record<string, number> = {};
  nonCancelled.forEach((o) => {
    const s = o.current_status || '';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  });
  const active = nonCancelled.filter((o) =>
    [
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ].includes(o.current_status || '')
  );
  const pending = nonCancelled.filter((o) => ['pending', 'pending_payment'].includes(o.current_status || ''));
  const delivered = nonCancelled.filter((o) => ['delivered', 'complete'].includes(o.current_status || ''));
  return {
    total: nonCancelled.length,
    active: active.length,
    pending: pending.length,
    delivered: delivered.length,
    byStatus,
  };
}

async function requestOrders(
  filters: ClientOrderListFilters | undefined
): Promise<{ orders: Order[]; error: string | null }> {
  const res = await agentApi.orders.getList(buildFiltersParam(filters));
  if (!res.success) {
    return { orders: [], error: res.message || 'Failed to fetch orders' };
  }
  return { orders: res.orders ?? [], error: null };
}

export function useClientOrders(enabled = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const lastFiltersRef = useRef<ClientOrderListFilters | undefined>(undefined);

  const fetchOrders = useCallback(
    async (filters?: ClientOrderListFilters, silent = false) => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      lastFiltersRef.current = filters;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const result = await requestOrders(filters);
        if (result.error) {
          if (!silent) setOrders([]);
          setError(result.error);
          return;
        }
        setOrders(result.orders);
      } catch (e: unknown) {
        if (!silent) setOrders([]);
        setError(e instanceof Error ? e.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    },
    [enabled]
  );

  const refresh = useCallback(() => {
    void fetchOrders(lastFiltersRef.current);
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        setLoading(false);
        return;
      }
      void fetchOrders(lastFiltersRef.current, true);
    }, [enabled, fetchOrders])
  );

  const stats = useMemo(() => computeStats(orders), [orders]);

  return { orders, loading, error, stats, fetchOrders, refresh };
}
