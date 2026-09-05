import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useBackendOrders } from './useBackendOrders';
import type { OrderData } from './useOrderById';
import { useApiClient } from './useApiClient';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { withOrdersApiPrefix } from '../contexts/OrdersApiPrefixContext';
import {
  incomingInterruptSecondsLeft,
  isActionableIncomingOrder,
  readIncomingInterruptPayload,
  resolveIncomingInterruptDeadline,
  shouldOpenIncomingInterrupt,
} from '../utils/incomingOrderInterrupt';

const POLL_MS = 15_000;
const BUSY_SNOOZE_MS = 15 * 60 * 1000;

type InterruptUiState =
  | 'idle'
  | 'loading'
  | 'active'
  | 'confirming'
  | 'busy'
  | 'error';

type IncomingOrderInterruptContextValue = {
  isBusinessPersona: boolean;
  visible: boolean;
  order: OrderData | null;
  uiState: InterruptUiState;
  message: string | null;
  secondsLeft: number | null;
  showDeclineDialog: boolean;
  refreshPending: () => Promise<void>;
  dismiss: () => void;
  openDeclineDialog: () => void;
  closeDeclineDialog: () => void;
  onDeclineSuccess: () => void;
  confirm: () => Promise<void>;
  markBusy: () => Promise<void>;
};

const IncomingOrderInterruptContext =
  createContext<IncomingOrderInterruptContextValue | null>(null);

export function IncomingOrderInterruptProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiClient = useApiClient();
  const { userType, isDelegationContext } = useUserProfileContext();
  const { confirmOrder, markBusy } = useBackendOrders();
  const [visible, setVisible] = useState(false);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [uiState, setUiState] = useState<InterruptUiState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const loadEpochRef = useRef(0);
  const snoozedUntilRef = useRef<Record<string, number>>({});
  const isBusinessPersona = userType === 'business';
  const interruptEnabled = isBusinessPersona || isDelegationContext;
  const ordersPrefix = isDelegationContext ? '/delegate' : '';

  const orderPath = useCallback(
    (path: string) => withOrdersApiPrefix(ordersPrefix, path),
    [ordersPrefix]
  );

  const clearVisibleState = useCallback(() => {
    loadEpochRef.current += 1;
    setVisible(false);
    setOrder(null);
    setUiState('idle');
    setMessage(null);
    setShowDeclineDialog(false);
  }, []);

  const isSnoozed = useCallback((orderId: string) => {
    const until = snoozedUntilRef.current[orderId];
    if (!until) return false;
    if (Date.now() >= until) {
      delete snoozedUntilRef.current[orderId];
      return false;
    }
    return true;
  }, []);

  const loadOrder = useCallback(
    async (orderId: string) => {
      if (!apiClient || !interruptEnabled || isSnoozed(orderId)) return;
      const epoch = loadEpochRef.current + 1;
      loadEpochRef.current = epoch;
      setVisible(true);
      setUiState('loading');
      setMessage(null);
      try {
        const response = await apiClient.get<{ success: boolean; order: OrderData }>(
          orderPath(`/orders/${orderId}`)
        );
        const nextOrder = response.data?.order ?? null;
        if (epoch !== loadEpochRef.current) return;
        if (!isActionableIncomingOrder(nextOrder)) {
          clearVisibleState();
          return;
        }
        setOrder(nextOrder);
        setUiState('active');
      } catch (error: any) {
        if (epoch !== loadEpochRef.current) return;
        setUiState('error');
        setMessage(
          error?.response?.data?.message ||
            error?.response?.data?.error ||
            error?.message ||
            'Could not load the incoming order.'
        );
      }
    },
    [apiClient, clearVisibleState, interruptEnabled, isSnoozed, orderPath]
  );

  const refreshPending = useCallback(async () => {
    if (!apiClient || !interruptEnabled) return;
    try {
      const response = await apiClient.get<{
        active: boolean;
        order: { id: string } | null;
      }>(orderPath('/orders/acceptance/pending'));
      const pendingId = response.data?.order?.id ?? null;
      if (!response.data?.active || !pendingId) {
        if (visible) {
          clearVisibleState();
        }
        return;
      }
      if (isSnoozed(pendingId)) return;
      // Keep the order the merchant was interrupted about; do not replace mid-view.
      if (visible && order?.id && order.id !== pendingId) return;
      await loadOrder(pendingId);
    } catch {
      // no-op
    }
  }, [
    apiClient,
    clearVisibleState,
    interruptEnabled,
    isSnoozed,
    loadOrder,
    order,
    orderPath,
    visible,
  ]);

  useEffect(() => {
    if (!interruptEnabled) {
      clearVisibleState();
      return;
    }
    void refreshPending();
    const intervalId = window.setInterval(() => {
      void refreshPending();
    }, POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [clearVisibleState, interruptEnabled, refreshPending]);

  useEffect(() => {
    if (!interruptEnabled) return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshPending();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [interruptEnabled, refreshPending]);

  useEffect(() => {
    if (!interruptEnabled || !('serviceWorker' in navigator)) return undefined;
    const handleMessage = (event: MessageEvent) => {
      const payload = readIncomingInterruptPayload(event);
      if (!shouldOpenIncomingInterrupt(payload.eventName)) return;
      if (payload.orderId) {
        void loadOrder(payload.orderId);
        return;
      }
      void refreshPending();
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [interruptEnabled, loadOrder, refreshPending]);

  useEffect(() => {
    if (!visible || uiState !== 'active') return undefined;
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [uiState, visible]);

  const dismiss = useCallback(() => {
    if (order?.id) {
      snoozedUntilRef.current[order.id] = Date.now() + BUSY_SNOOZE_MS;
    }
    clearVisibleState();
  }, [clearVisibleState, order]);

  const openDeclineDialog = useCallback(() => {
    setShowDeclineDialog(true);
  }, []);

  const closeDeclineDialog = useCallback(() => {
    setShowDeclineDialog(false);
  }, []);

  const onDeclineSuccess = useCallback(() => {
    clearVisibleState();
  }, [clearVisibleState]);

  const confirm = useCallback(async () => {
    if (!isActionableIncomingOrder(order) || !apiClient) return;
    setUiState('confirming');
    setMessage(null);
    const body = {
      orderId: order.id,
      ...(order.delivery_time_windows?.[0]?.id
        ? { delivery_time_window_id: order.delivery_time_windows[0].id }
        : {}),
    };
    try {
      if (isDelegationContext) {
        const response = await apiClient.post<{
          success: boolean;
          message?: string;
        }>(orderPath('/orders/confirm'), body);
        if (!response.data.success) {
          throw new Error(response.data.message || 'Could not confirm the order.');
        }
      } else {
        await confirmOrder(body);
      }
      clearVisibleState();
    } catch (error: any) {
      setUiState('active');
      setMessage(error?.message || 'Could not confirm the order.');
    }
  }, [
    apiClient,
    clearVisibleState,
    confirmOrder,
    isDelegationContext,
    order,
    orderPath,
  ]);

  const markOrderBusy = useCallback(async () => {
    if (!isActionableIncomingOrder(order) || !apiClient) return;
    setUiState('busy');
    setMessage(null);
    try {
      let snoozeUntil: string | undefined;
      if (isDelegationContext) {
        const response = await apiClient.post<{
          success: boolean;
          snoozeUntil?: string;
          message?: string;
        }>(orderPath('/orders/busy'), { orderId: order.id });
        if (!response.data.success) {
          throw new Error(
            response.data.message || 'Could not mark this order as busy.'
          );
        }
        snoozeUntil = response.data.snoozeUntil;
      } else {
        const result = await markBusy({ orderId: order.id });
        snoozeUntil = result.snoozeUntil;
      }
      snoozedUntilRef.current[order.id] = Number.isFinite(
        Date.parse(snoozeUntil || '')
      )
        ? Date.parse(snoozeUntil || '')
        : Date.now() + BUSY_SNOOZE_MS;
      clearVisibleState();
    } catch (error: any) {
      setUiState('active');
      setMessage(error?.message || 'Could not mark this order as busy.');
    }
  }, [
    apiClient,
    clearVisibleState,
    isDelegationContext,
    markBusy,
    order,
    orderPath,
  ]);

  const value = useMemo<IncomingOrderInterruptContextValue>(
    () => ({
      isBusinessPersona,
      visible,
      order,
      uiState,
      message,
      secondsLeft: incomingInterruptSecondsLeft(
        resolveIncomingInterruptDeadline(order),
        nowMs
      ),
      showDeclineDialog,
      refreshPending,
      dismiss,
      openDeclineDialog,
      closeDeclineDialog,
      onDeclineSuccess,
      confirm,
      markBusy: markOrderBusy,
    }),
    [
      closeDeclineDialog,
      confirm,
      dismiss,
      isBusinessPersona,
      markOrderBusy,
      message,
      nowMs,
      onDeclineSuccess,
      openDeclineDialog,
      order,
      refreshPending,
      showDeclineDialog,
      uiState,
      visible,
    ]
  );

  return (
    <IncomingOrderInterruptContext.Provider value={value}>
      {children}
    </IncomingOrderInterruptContext.Provider>
  );
}

export function useIncomingOrderInterrupt() {
  const value = useContext(IncomingOrderInterruptContext);
  if (!value) {
    throw new Error('useIncomingOrderInterrupt must be used inside its provider');
  }
  return value;
}
