import { useEffect, useRef } from 'react';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { enqueueAppDeepLink } from './useAppDeepLinkNavigation';
import { isDeliveryConfirmPush } from '../utils/deliveryConfirmLink';

const UUID = /^[0-9a-f-]{36}$/i;

/** Push data → `rendasua://orders/:id/confirm?src=push`, or null when not a delivery-confirm push. */
export function deliveryConfirmUrlFromPush(
  data: Record<string, unknown> | undefined
): string | null {
  if (!isDeliveryConfirmPush(data)) return null;
  const id = typeof data?.orderId === 'string' ? data.orderId.trim() : '';
  if (!UUID.test(id)) return null;
  return `rendasua://orders/${id}/confirm?src=push`;
}

/**
 * Delivered → Complete push taps reuse the deep-link queue, which keeps the
 * link through sign-in and switches to the client persona before rendering.
 */
export function useNotificationOpenedDeliveryConfirm(navReady: boolean): void {
  const handledInitial = useRef(false);

  useEffect(() => {
    if (!navReady) return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    void loadExpoNotifications().then((mod) => {
      if (!mod || cancelled) return;
      sub = mod.addNotificationResponseReceivedListener((response) => {
        const url = deliveryConfirmUrlFromPush(
          response.notification.request.content.data as Record<string, unknown> | undefined
        );
        if (url) enqueueAppDeepLink(url);
      });
      if (!handledInitial.current) {
        handledInitial.current = true;
        void mod.getLastNotificationResponseAsync().then((last) => {
          const url = deliveryConfirmUrlFromPush(
            last?.notification.request.content.data as Record<string, unknown> | undefined
          );
          if (!url) return;
          enqueueAppDeepLink(url);
          if (typeof mod.clearLastNotificationResponseAsync === 'function') {
            void mod.clearLastNotificationResponseAsync();
          }
        });
      }
    });
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [navReady]);
}
