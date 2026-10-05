import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { reaction } from 'mobx';
import { businessApi } from '../../services/businessApi';
import { useStore } from '../../stores/RootStore';
import type { BusinessOrder } from '../../types/business/orders';
import {
  partitionOrdersByActivity,
  TERMINAL_ORDER_STATUSES,
} from '../../utils/orderListGrouping';
import { sortActiveOrders } from '../../utils/buildActiveOrderCardModel';

const ACTIVE_ORDERS_FILTER = {
  current_status: { _nin: [...TERMINAL_ORDER_STATUSES] },
};

/**
 * Loads non-terminal business orders for the dashboard Active Orders carousel.
 * Refreshes on focus, when the app returns to the foreground, and when the
 * business orders subscription reports a new or updated order.
 */
export function useBusinessActiveOrders() {
  const { incomingOrder } = useStore();
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const focusedRef = useRef(false);
  const fetchRef = useRef<() => Promise<void>>(async () => undefined);

  const fetchOrders = useCallback(async () => {
    setError(null);
    try {
      const res = await businessApi.orders.list(ACTIVE_ORDERS_FILTER);
      if (res.success && res.orders) {
        const { active } = partitionOrdersByActivity(
          res.orders as BusinessOrder[]
        );
        setOrders(sortActiveOrders(active));
      } else {
        setOrders([]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load active orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  fetchRef.current = fetchOrders;

  const refresh = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setLoading(true);
      void fetchOrders();
      return () => {
        focusedRef.current = false;
      };
    }, [fetchOrders])
  );

  useEffect(() => {
    const dispose = reaction(
      () => ({
        visible: incomingOrder.visible,
        orderId: incomingOrder.orderId,
        uiState: incomingOrder.uiState,
        liveRevision: incomingOrder.liveRevision,
      }),
      () => {
        void fetchRef.current();
      }
    );
    return dispose;
  }, [incomingOrder]);

  useEffect(() => {
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active' && focusedRef.current) {
        void fetchRef.current();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, []);

  const activeCount = orders.length;

  return useMemo(
    () => ({
      orders,
      activeCount,
      loading,
      error,
      refresh,
    }),
    [orders, activeCount, loading, error, refresh]
  );
}
