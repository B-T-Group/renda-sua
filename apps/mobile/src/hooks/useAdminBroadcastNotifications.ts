import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import { parseAdminBroadcastFromNotification } from '../utils/parseAdminBroadcastPayload';

/**
 * Opens AdminBroadcastOverlay when the user taps an admin broadcast push.
 */
export function useAdminBroadcastNotifications(navReady: boolean): void {
  const { adminBroadcast, auth, persona } = useStore();
  const handledInitial = useRef(false);
  const canShowRef = useRef(false);

  const canShow =
    navReady &&
    auth.isAuthenticated &&
    persona.showMainApp &&
    (persona.activePersona === 'client' ||
      persona.activePersona === 'agent' ||
      persona.activePersona === 'business');
  canShowRef.current = canShow;

  useEffect(() => {
    if (!canShow) return;
    adminBroadcast.flushPending();
  }, [canShow, adminBroadcast]);

  useEffect(() => {
    let tapSub: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const notificationsMod = await loadExpoNotifications();
      if (!notificationsMod || cancelled) return;

      const openFromContent = (content: {
        title?: unknown;
        body?: unknown;
        data?: Record<string, unknown>;
      }) => {
        const parsed = parseAdminBroadcastFromNotification(content);
        if (!parsed) return;
        if (!canShowRef.current) {
          adminBroadcast.queuePending(parsed);
          return;
        }
        adminBroadcast.show(parsed);
      };

      tapSub = notificationsMod.addNotificationResponseReceivedListener(
        (response) => {
          openFromContent(response.notification.request.content);
        }
      );

      if (!handledInitial.current) {
        handledInitial.current = true;
        void notificationsMod.getLastNotificationResponseAsync().then((last) => {
          if (!last) return;
          const content = last.notification.request.content;
          if (parseAdminBroadcastFromNotification(content) === null) return;
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
        adminBroadcast.flushPending();
      }
    });

    return () => {
      cancelled = true;
      tapSub?.remove();
      appSub.remove();
    };
  }, [adminBroadcast]);
}
