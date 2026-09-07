import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import { parsePickupReminderFromNotification } from '../utils/parsePickupReminderPayload';

/**
 * Opens PickupReminderOverlay when the agent receives/taps a pickup reminder push.
 */
export function usePickupReminderNotifications(navReady: boolean): void {
  const { pickupReminder, auth, persona } = useStore();
  const handledInitial = useRef(false);
  const canShowRef = useRef(false);

  const canShow =
    navReady &&
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'agent';
  canShowRef.current = canShow;

  useEffect(() => {
    if (!canShow) return;
    pickupReminder.flushPending();
  }, [canShow, pickupReminder]);

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
        const parsed = parsePickupReminderFromNotification(content);
        if (!parsed) return;
        if (!canShowRef.current) {
          pickupReminder.queuePending(parsed);
          return;
        }
        pickupReminder.show(parsed);
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
          // Require full parse (title+body) before consuming the last response.
          if (parsePickupReminderFromNotification(content) === null) {
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
        pickupReminder.flushPending();
      }
    });

    return () => {
      cancelled = true;
      tapSub?.remove();
      foregroundSub?.remove();
      appSub.remove();
    };
  }, [pickupReminder]);
}
