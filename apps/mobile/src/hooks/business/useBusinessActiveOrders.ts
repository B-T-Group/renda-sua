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

const POLL_MS = 15_000;

const ACTIVE_ORDERS_FILTER = {
  current_status: { _nin: [...TERMINAL_ORDER_STATUSES] },
};

export type UseBusinessActiveOrdersOptions = {
  /**
   * When true (default), refresh on focus and poll every 15s while focused.
   * Set false for badge-only consumers (e.g. tab bar) to avoid duplicate polling
   * alongside the dashboard carousel hook.
   */
  pollWhileFocused?: boolean;
};

/**
 * Loads non-terminal business orders for the dashboard Active Orders carousel.
 * Refreshes on focus, pull-to-refresh, IncomingOrderStore changes, and a 15s poll while focused.
 */
export function useBusinessActiveOrders(
  options?: UseBusinessActiveOrdersOptions
) {
  const pollWhileFocused = options?.pollWhileFocused !== false;
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
      if (!pollWhileFocused) {
        return () => {
          focusedRef.current = false;
        };
      }
      const id = setInterval(() => {
        if (focusedRef.current && AppState.currentState === 'active') {
          void fetchRef.current();
        }
      }, POLL_MS);
      return () => {
        focusedRef.current = false;
        clearInterval(id);
      };
    }, [fetchOrders, pollWhileFocused])
  );

  useEffect(() => {
    const dispose = reaction(
      () => ({
        visible: incomingOrder.visible,
        orderId: incomingOrder.orderId,
        uiState: incomingOrder.uiState,
      }),
      () => {
        if (focusedRef.current) void fetchRef.current();
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
