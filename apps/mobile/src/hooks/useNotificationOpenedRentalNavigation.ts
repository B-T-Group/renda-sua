import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { rootNavigationRef } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';

type RentalPushTarget =
  | { kind: 'booking'; bookingId: string }
  | { kind: 'request'; requestId: string }
  | { kind: 'myRentals' };

let pendingRentalFromNotification: RentalPushTarget | null = null;

const RENTAL_PUSH_TYPES = new Set([
  'rental_request_new',
  'rental_request_accepted',
  'rental_request_rejected',
  'rental_booking_confirmed',
  'rental_period_ended',
  'rental_booking_message',
  'rental_start_pin_shared',
]);

function parseRentalPushPayload(
  data: Record<string, unknown> | undefined
): RentalPushTarget | null {
  if (!data) return null;
  const type = typeof data.type === 'string' ? data.type : '';
  const looksRental =
    type.startsWith('rental_') || RENTAL_PUSH_TYPES.has(type);
  if (!looksRental && !data.rentalBookingId && !data.rentalRequestId) {
    return null;
  }

  const bookingRaw = data.rentalBookingId ?? data.bookingId;
  if (typeof bookingRaw === 'string' && bookingRaw.trim()) {
    return { kind: 'booking', bookingId: bookingRaw.trim() };
  }

  const url = typeof data.url === 'string' ? data.url : '';
  const urlMatch = url.match(/\/rentals\/bookings\/([0-9a-f-]{36})/i);
  if (urlMatch?.[1]) {
    return { kind: 'booking', bookingId: urlMatch[1] };
  }

  const requestRaw = data.rentalRequestId ?? data.requestId;
  if (typeof requestRaw === 'string' && requestRaw.trim()) {
    return { kind: 'request', requestId: requestRaw.trim() };
  }

  if (looksRental) return { kind: 'myRentals' };
  return null;
}

function navigateRentalTarget(
  target: RentalPushTarget,
  persona: 'client' | 'business' | 'agent' | null
): boolean {
  if (!rootNavigationRef.isReady()) return false;
  if (target.kind === 'booking') {
    if (persona === 'business') {
      rootNavigationRef.dispatch(
        CommonActions.navigate({
          name: 'BusinessRentalBookingDetail',
          params: { bookingId: target.bookingId },
        })
      );
      return true;
    }
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'RentalBookingDetail',
        params: { bookingId: target.bookingId },
      })
    );
    return true;
  }
  if (persona === 'business') {
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'BusinessRentalsStudio',
      })
    );
    return true;
  }
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'ClientMyRentals',
    })
  );
  return true;
}

/**
 * Opens rental booking / my-rentals when the user taps a push whose type is rental_*.
 */
export function useNotificationOpenedRentalNavigation(navReady: boolean): void {
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

  const activePersona = persona.activePersona;
  const canOpenApp =
    auth.isAuthenticated &&
    persona.showMainApp &&
    (activePersona === 'client' || activePersona === 'business');

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromResponse = (data: Record<string, unknown> | undefined): void => {
      const parsed = parseRentalPushPayload(data);
      if (!parsed) return;
      const opened =
        canOpenApp &&
        navigateRentalTarget(
          parsed,
          activePersona === 'client' || activePersona === 'business'
            ? activePersona
            : null
        );
      if (!opened) pendingRentalFromNotification = parsed;
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      openFromResponse(data);
    });

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseRentalPushPayload(data) === null) return;
        openFromResponse(data);
        if (typeof notificationsMod.clearLastNotificationResponseAsync === 'function') {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }

    return () => sub.remove();
  }, [notificationsMod, navReady, canOpenApp, activePersona]);

  useEffect(() => {
    if (!navReady || !canOpenApp) return;
    const pending = pendingRentalFromNotification;
    if (!pending) return;
    if (
      navigateRentalTarget(
        pending,
        activePersona === 'client' || activePersona === 'business'
          ? activePersona
          : null
      )
    ) {
      pendingRentalFromNotification = null;
    }
  }, [navReady, canOpenApp, activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !canOpenApp) return;
      const pending = pendingRentalFromNotification;
      if (!pending) return;
      if (
        navigateRentalTarget(
          pending,
          activePersona === 'client' || activePersona === 'business'
            ? activePersona
            : null
        )
      ) {
        pendingRentalFromNotification = null;
      }
    });
    return () => sub.remove();
  }, [canOpenApp, activePersona]);
}
