import { useEffect, useRef, useState } from 'react';
import i18n from '../i18n';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { stopRestockAlertsFromMessage } from '../services/restockAlertsApi';
import { enqueueAppDeepLink } from './useAppDeepLinkNavigation';
import {
  parseRestockPush,
  RESTOCK_PUSH_CATEGORY_ID,
  STOP_ACTION_ID,
} from '../utils/restockDeepLink';

type NotificationsModule = NonNullable<Awaited<ReturnType<typeof loadExpoNotifications>>>;

type PushResponse = {
  actionIdentifier?: string;
  notification: { request: { content: { data?: unknown } } };
};

function handleResponse(response: PushResponse): boolean {
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const parsed = parseRestockPush(data, response.actionIdentifier);
  if (!parsed) return false;
  if (parsed.kind === 'stop') {
    // Notification action: works without a session (token is the credential).
    void stopRestockAlertsFromMessage(parsed.token).catch(() => undefined);
    return true;
  }
  // Same queue as rendasua:// and https://…/app links: waits for auth, switches
  // to the client persona, then opens the item or Likes > Back in stock.
  enqueueAppDeepLink(parsed.url);
  return true;
}

/**
 * Handles restock push taps (contract §2): `restock.alert` opens the live item
 * (`src=restock_alert`), `restock.digest` opens Likes with "Back in stock", and
 * the `stop_restock_alerts` action POSTs the single-use token.
 *
 * The notification category registered here only produces a visible action
 * button when the push carries `categoryId: 'restock_alert'` (backend follow-up).
 */
export function useNotificationOpenedRestockAlertNavigation(navReady: boolean): void {
  const handledInitialResponse = useRef(false);
  const [notificationsMod, setNotificationsMod] = useState<NotificationsModule | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void loadExpoNotifications().then((mod) => {
      if (!cancelled) setNotificationsMod(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notificationsMod) return;
    const setCategory = (
      notificationsMod as { setNotificationCategoryAsync?: unknown }
    ).setNotificationCategoryAsync as
      | ((id: string, actions: unknown[]) => Promise<unknown>)
      | undefined;
    if (typeof setCategory !== 'function') return;
    void setCategory(RESTOCK_PUSH_CATEGORY_ID, [
      {
        identifier: STOP_ACTION_ID,
        buttonTitle: i18n.t('restockAlerts.stopAction', 'Stop restock alerts'),
        options: { opensAppToForeground: false },
      },
    ]).catch(() => undefined);
  }, [notificationsMod]);

  useEffect(() => {
    if (!notificationsMod || !navReady) return;
    const sub = notificationsMod.addNotificationResponseReceivedListener((response) => {
      handleResponse(response as PushResponse);
    });
    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        if (!handleResponse(last as PushResponse)) return;
        if (typeof notificationsMod.clearLastNotificationResponseAsync === 'function') {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }
    return () => sub.remove();
  }, [notificationsMod, navReady]);
}
