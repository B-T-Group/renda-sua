import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { navigateToInventoryItemFromPush } from '../navigation/rootNavigationRef';
import { clearStockAvailabilityPending } from './useStockAvailabilityChecks';
import { useStore } from '../stores/RootStore';

type AvailabilityResult = 'confirmed' | 'adjusted' | 'unavailable';

type ResultPayload = {
  inventoryId: string;
  status: AvailabilityResult;
  quantity?: number;
};

let pendingResult: ResultPayload | null = null;

function parseResult(data: Record<string, unknown> | undefined): ResultPayload | null {
  if (!data || data.type !== 'stock_availability_result') return null;
  const inventoryId =
    typeof data.inventoryId === 'string' && data.inventoryId.trim()
      ? data.inventoryId.trim()
      : null;
  if (!inventoryId) return null;
  const statusRaw = typeof data.status === 'string' ? data.status : '';
  if (
    statusRaw !== 'confirmed' &&
    statusRaw !== 'adjusted' &&
    statusRaw !== 'unavailable'
  ) {
    return null;
  }
  const qtyRaw = data.quantity;
  const quantity =
    typeof qtyRaw === 'number'
      ? qtyRaw
      : typeof qtyRaw === 'string' && qtyRaw.trim()
        ? Number(qtyRaw)
        : undefined;
  return {
    inventoryId,
    status: statusRaw,
    quantity: Number.isFinite(quantity) ? quantity : undefined,
  };
}

function navigateWhenReady(payload: ResultPayload, maxAttempts = 24): void {
  clearStockAvailabilityPending(payload.inventoryId);
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (
      navigateToInventoryItemFromPush(
        payload.inventoryId,
        payload.status,
        payload.quantity
      )
    ) {
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(tryNavigate, 250);
      return;
    }
    pendingResult = payload;
  };
  tryNavigate();
}

function flushPendingIfReady(canOpen: boolean): void {
  if (!canOpen) return;
  const pending = pendingResult;
  if (!pending) return;
  pendingResult = null;
  navigateWhenReady(pending);
}

/** Opens item detail with a snack when the client taps the availability result push. */
export function useNotificationOpenedStockAvailabilityResultNavigation(
  navReady: boolean
): void {
  const { auth, persona } = useStore();
  const handledInitialResponse = useRef(false);
  const [notificationsMod, setNotificationsMod] = useState<Awaited<
    ReturnType<typeof loadExpoNotifications>
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadExpoNotifications().then((mod) => {
      if (!cancelled) setNotificationsMod(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const canOpenClientApp =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'client';

  const canSwitchToClient =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona !== 'client' &&
    persona.personas.includes('client') &&
    !persona.pickingPersona;

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromResponse = (data: Record<string, unknown> | undefined): void => {
      const parsed = parseResult(data);
      if (!parsed) return;
      if (canOpenClientApp) {
        navigateWhenReady(parsed);
        return;
      }
      pendingResult = parsed;
      if (canSwitchToClient) {
        void persona.selectPersona('client');
      }
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      openFromResponse(data);
    });

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseResult(data) === null) return;
        openFromResponse(data);
        if (typeof notificationsMod.clearLastNotificationResponseAsync === 'function') {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }

    return () => sub.remove();
  }, [notificationsMod, navReady, canOpenClientApp, canSwitchToClient, persona]);

  useEffect(() => {
    if (!navReady) return;
    flushPendingIfReady(canOpenClientApp);
  }, [navReady, canOpenClientApp, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPendingIfReady(canOpenClientApp);
    });
    return () => sub.remove();
  }, [canOpenClientApp]);
}
