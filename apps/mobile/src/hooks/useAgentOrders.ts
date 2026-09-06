import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import { useStore } from '../stores/RootStore';
import type { Order } from '../types/agent';
import { partitionOrdersByActivity } from '../utils/orderListGrouping';
import { sortOrdersByModifiedDesc } from '../utils/orderListSort';

function categorizeOrders<T extends Order>(orders: T[]) {
  const parts = partitionOrdersByActivity(orders);
  return {
    active: sortOrdersByModifiedDesc(parts.active),
    completed: sortOrdersByModifiedDesc(parts.completed),
    cancelled: sortOrdersByModifiedDesc(parts.cancelled),
  };
}

export function useAgentOrders() {
  const { ordersSignal } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [categorized, setCategorized] = useState<{ active: Order[]; completed: Order[]; cancelled: Order[] }>({
    active: [],
    completed: [],
    cancelled: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.orders.getList();
      if (res.success && res.orders) {
        setOrders(res.orders);
        setCategorized(categorizeOrders(res.orders));
        return res.orders;
      }
      setOrders([]);
      setCategorized({ active: [], completed: [], cancelled: [] });
      return [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement commandes';
      setError(msg);
      setOrders([]);
      setCategorized({ active: [], completed: [], cancelled: [] });
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const runStatusAction = useCallback(
    async <T extends { success: boolean; message?: string }>(action: () => Promise<T>): Promise<T> => {
      const res = await action();
      if (!res.success) throw new Error(res.message);
      ordersSignal.notifyStatusChanged();
      await fetchOrders();
      return res;
    },
    [fetchOrders, ordersSignal]
  );

  const pickUp = useCallback(
    (orderId: string, notes?: string) => runStatusAction(() => agentApi.orders.pickUp(orderId, notes)),
    [runStatusAction]
  );

  const startTransit = useCallback(
    (orderId: string, notes?: string) => runStatusAction(() => agentApi.orders.startTransit(orderId, notes)),
    [runStatusAction]
  );

  const outForDelivery = useCallback(
    (orderId: string, notes?: string) => runStatusAction(() => agentApi.orders.outForDelivery(orderId, notes)),
    [runStatusAction]
  );

  const deliver = useCallback(
    (orderId: string, notes?: string) => runStatusAction(() => agentApi.orders.deliver(orderId, notes)),
    [runStatusAction]
  );

  const completeDelivery = useCallback(
    (orderId: string, params: {
      pin?: string;
      overwriteCode?: string;
      pinMessageId?: string;
      useLatestSharedPin?: boolean;
    }) =>
      runStatusAction(() => agentApi.orders.completeDelivery({ orderId, ...params })),
    [runStatusAction]
  );

  const initiatePayAtDeliveryPayment = useCallback(
    (orderId: string, phone_number?: string) =>
      runStatusAction(() =>
        agentApi.orders.initiatePayAtDeliveryPayment(
          orderId,
          phone_number?.trim() ? { phone_number: phone_number.trim() } : {}
        )
      ),
    [runStatusAction]
  );

  const markPaidInCashException = useCallback(
    (orderId: string, notes?: string) =>
      runStatusAction(() =>
        agentApi.orders.markPaidInCashException(orderId, { notes: notes?.trim() || undefined })
      ),
    [runStatusAction]
  );

  const dropOrder = useCallback(
    (orderId: string) => runStatusAction(() => agentApi.orders.dropOrder(orderId)),
    [runStatusAction]
  );

  const requestPickupDelay = useCallback(
    (orderId: string) =>
      runStatusAction(() => agentApi.orders.requestPickupDelay(orderId)),
    [runStatusAction]
  );

  const reportPickupIssue = useCallback(
    (orderId: string, reason?: string) =>
      runStatusAction(() => agentApi.orders.reportPickupIssue(orderId, reason)),
    [runStatusAction]
  );

  const failDelivery = useCallback(
    (orderId: string, failure_reason_id: string, notes?: string) =>
      runStatusAction(() => agentApi.failedDeliveries.fail({ orderId, failure_reason_id, notes })),
    [runStatusAction]
  );

  return {
    orders,
    categorized,
    loading,
    error,
    refetch: fetchOrders,
    pickUp,
    startTransit,
    outForDelivery,
    deliver,
    completeDelivery,
    initiatePayAtDeliveryPayment,
    markPaidInCashException,
    dropOrder,
    requestPickupDelay,
    reportPickupIssue,
    failDelivery,
  };
}
