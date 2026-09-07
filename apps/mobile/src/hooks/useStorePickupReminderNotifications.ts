import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import { parseStorePickupReminderFromNotification } from '../utils/parseStorePickupReminderPayload';

/**
 * Opens client store-pickup reminder sheet when the push is received/tapped.
 */
export function useStorePickupReminderNotifications(navReady: boolean): void {
  const { storePickupReminder, auth, persona } = useStore();
  const handledInitial = useRef(false);
  const canShowRef = useRef(false);

  const canShow =
    navReady &&
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'client';
  canShowRef.current = canShow;

  useEffect(() => {
    if (!canShow) return;
    storePickupReminder.flushPending();
  }, [canShow, storePickupReminder]);

  useEffect(() => {
    let tapSub: { remove: () => void } | undefined;
    let foregroundSub: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const notificationsMod = await loadExpoNotifications();
      if (!notificationsMod || cancelled) return;

      const openFromContent = (content: {
        title?: unknown;
        body?: unknown;
        data?: Record<string, unknown>;
      }) => {
        const parsed = parseStorePickupReminderFromNotification(content);
        if (!parsed) return;
        if (!canShowRef.current) {
          storePickupReminder.queuePending(parsed);
          return;
        }
        storePickupReminder.show(parsed);
      };

      tapSub = notificationsMod.addNotificationResponseReceivedListener(
        (response) => {
          openFromContent(response.notification.request.content);
        }
      );

      foregroundSub = notificationsMod.addNotificationReceivedListener(
        (notification) => {
          openFromContent(notification.request.content);
        }
      );

      if (!handledInitial.current) {
        handledInitial.current = true;
        void notificationsMod.getLastNotificationResponseAsync().then((last) => {
          if (!last) return;
          const content = last.notification.request.content;
          if (parseStorePickupReminderFromNotification(content) === null) {
            return;
          }
          openFromContent(content);
          if (
            typeof notificationsMod.clearLastNotificationResponseAsync ===
            'function'
          ) {
            void notificationsMod.clearLastNotificationResponseAsync();
          }
        });
      }
    })();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && canShowRef.current) {
        storePickupReminder.flushPending();
      }
    });

    return () => {
      cancelled = true;
      tapSub?.remove();
      foregroundSub?.remove();
      appSub.remove();
    };
  }, [storePickupReminder]);
}
