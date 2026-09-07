import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { agentApi } from '../services/agentApi';
import { useStore } from '../stores/RootStore';
import type { Order } from '../types/agent';
import { sortOrdersByModifiedDesc } from '../utils/orderListSort';

const ACTIVE_STATUSES = [
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
];

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Internal state hook for the agent's current active delivery.
 * Prefer `useAgentActiveDelivery` from AgentActiveDeliveryContext so polling
 * runs once per app tree.
 */
export function useAgentActiveDeliveryState() {
  const { auth, persona, ordersSignal } = useStore();
  const statusVersion = ordersSignal.version;
  const enabled =
    auth.isAuthenticated &&
    !!auth.user?.id &&
    persona.showMainApp &&
    !persona.isDelegationContext &&
    persona.activePersona === 'agent';

  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const fetchingRef = useRef(false);
  const pendingRefetchRef = useRef(false);
  const lastSignalRef = useRef(statusVersion);

  const refetch = useCallback(async (opts?: { syncing?: boolean }) => {
    if (!enabled) return;
    if (fetchingRef.current) {
      pendingRefetchRef.current = true;
      if (opts?.syncing) setSyncing(true);
      return;
    }
    fetchingRef.current = true;
    if (opts?.syncing) setSyncing(true);
    try {
      do {
        pendingRefetchRef.current = false;
        const res = await agentApi.orders.getList();
        const orders = res.success && res.orders ? res.orders : [];
        const active = sortOrdersByModifiedDesc(
          orders.filter((o) => ACTIVE_STATUSES.includes(o.current_status))
        );
        setActiveOrders(active);
      } while (pendingRefetchRef.current);
    } catch {
      // Keep the last known value on transient errors.
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setSyncing(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setActiveOrders([]);
      setLoading(false);
      setSyncing(false);
      return undefined;
    }
    void refetch();
    const interval = setInterval(() => void refetch(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, refetch]);

  useEffect(() => {
    if (!enabled) return;
    if (lastSignalRef.current === statusVersion) return;
    lastSignalRef.current = statusVersion;
    void refetch({ syncing: true });
  }, [enabled, statusVersion, refetch]);

  useEffect(() => {
    if (!enabled) return undefined;
    const appStateRef: { current: AppStateStatus } = {
      current: AppState.currentState,
    };
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        void refetch();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [enabled, refetch]);

  return {
    enabled,
    loading,
    syncing,
    activeOrders,
    activeOrder: activeOrders[0] ?? null,
    hasActiveOrders: activeOrders.length > 0,
    /** Prefer active GPS cadence while loading/syncing so claims aren't idle for ~1m. */
    preferActiveLocationCadence: loading || syncing || activeOrders.length > 0,
    refetch,
  };
}
