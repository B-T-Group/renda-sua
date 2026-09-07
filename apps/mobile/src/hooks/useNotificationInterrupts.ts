import { useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { matchInterrupt, type InterruptMatch } from '../notifications/interruptRegistry';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { ensureDefaultNotificationHandler } from '../services/notificationRegistrationService';
import { PushNotificationService } from '../services/pushNotificationService';
import { useStore } from '../stores/RootStore';

function dispatchInterrupt(
  match: InterruptMatch,
  fromTap: boolean,
  stores: ReturnType<typeof useStore>
): void {
  const { orderOffer, incomingOrder, stockAvailability, persona } = stores;

  if (match.kind === 'order_offer') {
    if (match.cancelled) {
      orderOffer.cancelIfMatches(match.orderId);
      return;
    }
    if (fromTap) {
      void orderOffer.handleOfferTap(match.orderId);
    } else {
      void orderOffer.handleOfferPush(match.orderId);
    }
    setTimeout(() => {
      void orderOffer.checkPendingOffer();
    }, 800);
    return;
  }

  if (match.kind === 'incoming_order') {
    if (match.locationId || persona.isDelegationContext) {
      incomingOrder.notifyDelegateForegroundOrder();
      return;
    }
    Vibration.vibrate([0, 600, 200, 600]);
    void incomingOrder.handleIncomingPush(match.orderId);
    return;
  }

  if (fromTap) {
    void stockAvailability.handleTap(match.messageId);
  } else {
    void stockAvailability.handlePush(match.messageId);
  }
}

/**
 * Single dispatcher for overlay interrupts (delivery offer, incoming order,
 * stock availability). Present-first: the matching store shows immediately;
 * persona switch is the store's responsibility behind the modal.
 */
export function useNotificationInterrupts(navReady: boolean): void {
  const store = useStore();
  const { orderOffer, incomingOrder, stockAvailability, auth, persona } = store;
  const handledInitial = useRef(false);
  const [notificationsMod, setNotificationsMod] = useState<Awaited<
    ReturnType<typeof loadExpoNotifications>
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureDefaultNotificationHandler();
      await PushNotificationService.setupAndroidChannel();
      const mod = await loadExpoNotifications();
      if (!cancelled) setNotificationsMod(mod);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notificationsMod) return;

    const tapSub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const match = matchInterrupt(data);
        if (!match) return;
        if (match.kind === 'incoming_order' && match.locationId) return;
        dispatchInterrupt(match, true, store);
      }
    );

    const foregroundSub = notificationsMod.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        const match = matchInterrupt(data);
        if (!match) return;
        dispatchInterrupt(match, false, store);
      }
    );

    return () => {
      tapSub.remove();
      foregroundSub.remove();
    };
  }, [notificationsMod, store]);

  useEffect(() => {
    if (!notificationsMod || !navReady || handledInitial.current) return;
    handledInitial.current = true;
    void notificationsMod.getLastNotificationResponseAsync().then((last) => {
      if (!last) return;
      const data = last.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const match = matchInterrupt(data);
      if (!match) return;
      if (match.kind === 'incoming_order' && match.locationId) return;
      dispatchInterrupt(match, true, store);
      if (typeof notificationsMod.clearLastNotificationResponseAsync === 'function') {
        void notificationsMod.clearLastNotificationResponseAsync();
      }
    });
  }, [notificationsMod, navReady, store]);

  useEffect(() => {
    orderOffer.flushPending();
    void orderOffer.checkPendingOffer();
    incomingOrder.flushPending();
    if (!persona.isDelegationContext) {
      void incomingOrder.checkPendingIncoming();
    }
    stockAvailability.flushPending();
  }, [
    orderOffer,
    incomingOrder,
    stockAvailability,
    auth.isAuthenticated,
    persona.loadState,
    persona.activePersona,
    persona.showMainApp,
    persona.isDelegationContext,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      orderOffer.flushPending();
      void orderOffer.checkPendingOffer();
      incomingOrder.flushPending();
      if (!persona.isDelegationContext) {
        void incomingOrder.checkPendingIncoming();
      }
      stockAvailability.flushPending();
    });
    return () => sub.remove();
  }, [
    orderOffer,
    incomingOrder,
    stockAvailability,
    persona.activePersona,
    persona.showMainApp,
    persona.isDelegationContext,
  ]);
}
