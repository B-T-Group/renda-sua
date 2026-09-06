import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import {
  parseReferralRejectionFromNotification,
  parseReferralRejectionPayload,
} from '../utils/parseReferralRejectionPayload';

/**
 * Opens ReferralRejectionOverlay when the agent taps a rejection push.
 */
export function useReferralRejectionNotifications(navReady: boolean): void {
  const { referralRejection, auth, persona } = useStore();
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
    referralRejection.flushPending();
  }, [canShow, referralRejection]);

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
        const parsed = parseReferralRejectionFromNotification(content);
        if (!parsed) return;
        if (!canShowRef.current) {
          referralRejection.queuePending(parsed);
          return;
        }
        referralRejection.show(parsed);
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
          if (parseReferralRejectionPayload(content.data ?? null) === null) {
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
        referralRejection.flushPending();
      }
    });

    return () => {
      cancelled = true;
      tapSub?.remove();
      appSub.remove();
    };
  }, [referralRejection]);
}
