import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { navigateToAdminOrderFromPush } from '../navigation/rootNavigationRef';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import { parseAdminOrderRiskPayload } from '../utils/parseAdminOrderRiskPayload';

/** Order id (or empty string for "open the queue") kept until the shell mounts. */
let pendingAdminOrder: string | null = null;

/**
 * Retries until the business stack has registered the admin routes, which does
 * not happen on the same tick as `navReady` after a cold start or a persona
 * switch. Falls back to the pending slot so a later flush can pick it up.
 */
function navigateWhenReady(orderId: string, maxAttempts = 24): void {
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (navigateToAdminOrderFromPush(orderId || null)) {
      pendingAdminOrder = null;
      return;
    }
    if (attempts < maxAttempts) setTimeout(tryNavigate, 250);
    else pendingAdminOrder = orderId;
  };
  tryNavigate();
}

function flushPending(canOpen: boolean): void {
  if (!canOpen || pendingAdminOrder === null) return;
  const orderId = pendingAdminOrder;
  pendingAdminOrder = null;
  navigateWhenReady(orderId);
}

/**
 * Opens the admin order intervention detail when a superuser taps an
 * `admin_order_risk` push. The queue is used as a fallback when the incident
 * no longer resolves to an order the operator can open.
 */
export function useNotificationOpenedAdminOrderNavigation(
  navReady: boolean
): void {
  const { auth, persona } = useStore();
  const handledInitial = useRef(false);
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

  // The admin order screens only exist inside the business shell.
  const canOpenAdminOrders =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'business';

  const canSwitchToBusiness =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona !== 'business' &&
    persona.personas.includes('business') &&
    !persona.pickingPersona;

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromData = (data: Record<string, unknown> | undefined): void => {
      const orderId = parseAdminOrderRiskPayload(data);
      if (orderId === null) return;
      if (canOpenAdminOrders) {
        navigateWhenReady(orderId);
        return;
      }
      pendingAdminOrder = orderId;
      if (canSwitchToBusiness) void persona.selectPersona('business');
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        openFromData(
          response.notification.request.content.data as
            | Record<string, unknown>
            | undefined
        );
      }
    );

    if (!handledInitial.current) {
      handledInitial.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseAdminOrderRiskPayload(data) === null) return;
        openFromData(data);
        if (
          typeof notificationsMod.clearLastNotificationResponseAsync ===
          'function'
        ) {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }

    return () => sub.remove();
  }, [
    notificationsMod,
    navReady,
    canOpenAdminOrders,
    canSwitchToBusiness,
    persona,
  ]);

  useEffect(() => {
    if (!navReady) return;
    flushPending(canOpenAdminOrders);
  }, [navReady, canOpenAdminOrders, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPending(canOpenAdminOrders);
    });
    return () => sub.remove();
  }, [canOpenAdminOrders]);
}
