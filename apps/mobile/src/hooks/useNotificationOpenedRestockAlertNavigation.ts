import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import type { ClientRootStackParamList } from '../navigation/types';

type ParsedRestockPayload =
  | { type: 'single'; inventoryItemId: string }
  | { type: 'digest' }
  | null;

function parseRestockPayload(
  data: Record<string, unknown> | undefined
): ParsedRestockPayload {
  if (!data || data.src !== 'restock_alert') return null;

  if (data.digest === true) {
    return { type: 'digest' };
  }

  if (typeof data.inventory_item_id === 'string') {
    return { type: 'single', inventoryItemId: data.inventory_item_id };
  }

  return null;
}

let pendingRestockPayload: ParsedRestockPayload | null = null;
let pendingRetryTimer: ReturnType<typeof setTimeout> | null = null;

const PENDING_RETRY_DELAY_MS = 150;
const PENDING_RETRY_ATTEMPTS = 12;

function schedulePendingRetry(flush: () => boolean, attemptsLeft: number): void {
  if (pendingRetryTimer) clearTimeout(pendingRetryTimer);
  if (attemptsLeft <= 0) return;
  pendingRetryTimer = setTimeout(() => {
    pendingRetryTimer = null;
    if (!flush()) schedulePendingRetry(flush, attemptsLeft - 1);
  }, PENDING_RETRY_DELAY_MS);
}

/**
 * Opens item detail or Likes screen when user taps a restock alert push.
 * Single item: navigates to InventoryItemDetail
 * Digest: navigates to UserLikes with 'back_in_stock' filter preselected
 */
export function useNotificationOpenedRestockAlertNavigation(
  navReady: boolean
): void {
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
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

  const canOpenMainApp = auth.isAuthenticated && persona.showMainApp;
  const isOnClient =
    persona.activePersona === 'client' && !persona.isDelegationContext;

  const tryOpenRestock = useCallback(
    (payload: ParsedRestockPayload): boolean => {
      if (!payload || !canOpenMainApp || !isOnClient) return false;

      if (payload.type === 'digest') {
        navigation.navigate('UserLikes', { filter: 'back_in_stock' });
        return true;
      }

      if (payload.type === 'single') {
        navigation.navigate('InventoryItemDetail', {
          inventoryItemId: payload.inventoryItemId,
        });
        return true;
      }

      return false;
    },
    [canOpenMainApp, isOnClient, navigation]
  );

  const flushPending = useCallback((): boolean => {
    const pending = pendingRestockPayload;
    if (!pending) return true;

    // Wait until we're on client persona
    if (!isOnClient && persona.personas.includes('client')) {
      if (!persona.pickingPersona) {
        void persona.selectPersona('client');
      }
      return false;
    }

    if (!tryOpenRestock(pending)) return false;
    pendingRestockPayload = null;
    return true;
  }, [isOnClient, persona, tryOpenRestock]);

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromResponse = (
      data: Record<string, unknown> | undefined
    ): void => {
      const parsed = parseRestockPayload(data);
      if (!parsed) return;

      // If not on client, queue and switch persona
      if (!isOnClient && persona.personas.includes('client')) {
        pendingRestockPayload = parsed;
        if (!persona.pickingPersona) {
          void persona.selectPersona('client');
        }
        schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
        return;
      }

      if (tryOpenRestock(parsed)) return;
      pendingRestockPayload = parsed;
      schedulePendingRetry(flushPending, PENDING_RETRY_ATTEMPTS);
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
        if (parseRestockPayload(data) === null) return;
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
  }, [
    notificationsMod,
    navReady,
    canOpenMainApp,
    isOnClient,
    flushPending,
    tryOpenRestock,
    persona,
  ]);

  useEffect(() => {
    if (!navReady) return;
    flushPending();
  }, [
    navReady,
    flushPending,
    persona.activePersona,
    persona.pickingPersona,
    isOnClient,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPending();
    });
    return () => sub.remove();
  }, [flushPending]);
}
