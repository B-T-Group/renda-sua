import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { navigateToLocationTransferFromPush } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';

let pendingTransferFromNotification: string | null = null;

const TRANSFER_PUSH_TYPES = new Set([
  'business_location_transfer',
  'business_location_transfer_result',
]);

function parseTransferRequestId(
  data: Record<string, unknown> | undefined
): string | null {
  if (!data) return null;
  const type = typeof data.type === 'string' ? data.type : '';
  const looksTransfer =
    TRANSFER_PUSH_TYPES.has(type) ||
    type.startsWith('business_location_transfer');
  const raw = data.requestId;
  if (typeof raw === 'string' && raw.trim()) {
    if (looksTransfer || type === '') return raw.trim();
  }
  if (!looksTransfer) return null;
  const url = data.url;
  if (typeof url === 'string') {
    const m = url.match(/transferRequestId=([0-9a-f-]{36})/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Retry until the business navigator has mounted (persona switch / cold start).
 * Re-queues the request when every attempt fails so a later flush can retry.
 */
function navigateWhenReady(requestId: string, maxAttempts = 20): void {
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (navigateToLocationTransferFromPush(requestId)) return;
    if (attempts < maxAttempts) {
      setTimeout(tryNavigate, 250);
      return;
    }
    pendingTransferFromNotification = requestId;
  };
  tryNavigate();
}

/**
 * Opens business locations with a focused transfer request when the user taps
 * a business_location_transfer* push. Switches to the business persona first
 * when the user has business access but another persona is active.
 */
export function useNotificationOpenedLocationTransferNavigation(
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

  const canOpenBusinessApp =
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

    const openFromResponse = (data: Record<string, unknown> | undefined): void => {
      const requestId = parseTransferRequestId(data);
      if (!requestId) return;
      if (canOpenBusinessApp) {
        navigateWhenReady(requestId);
        return;
      }
      pendingTransferFromNotification = requestId;
      if (canSwitchToBusiness) {
        void persona.selectPersona('business');
      }
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        openFromResponse(data);
      }
    );

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseTransferRequestId(data) === null) return;
        openFromResponse(data);
        if (
          typeof notificationsMod.clearLastNotificationResponseAsync ===
          'function'
        ) {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }

    return () => sub.remove();
  }, [notificationsMod, navReady, canOpenBusinessApp, canSwitchToBusiness, persona]);

  useEffect(() => {
    if (!navReady || !canOpenBusinessApp) return;
    const pending = pendingTransferFromNotification;
    if (!pending) return;
    pendingTransferFromNotification = null;
    navigateWhenReady(pending);
  }, [navReady, canOpenBusinessApp, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !canOpenBusinessApp) return;
      const pending = pendingTransferFromNotification;
      if (!pending) return;
      pendingTransferFromNotification = null;
      navigateWhenReady(pending);
    });
    return () => sub.remove();
  }, [canOpenBusinessApp]);
}
