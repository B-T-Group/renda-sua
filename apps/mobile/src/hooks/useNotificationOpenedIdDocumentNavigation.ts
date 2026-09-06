import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { navigateToDocumentsFromPush } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';
import type { PersonaSlug } from '../types/persona';

let pendingIdDocumentNav = false;
let navigateInFlight = false;

function isIdDocumentPush(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const type = typeof data.type === 'string' ? data.type : '';
  return type === 'id_document_approved' || type === 'id_document_rejected';
}

function preferredPersona(
  active: PersonaSlug,
  enrolled: PersonaSlug[]
): PersonaSlug | null {
  if (active === 'business' || active === 'agent') return active;
  if (enrolled.includes('business')) return 'business';
  if (enrolled.includes('agent')) return 'agent';
  return null;
}

function navigateWhenReady(maxAttempts = 24): void {
  if (navigateInFlight) return;
  navigateInFlight = true;
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (navigateToDocumentsFromPush()) {
      pendingIdDocumentNav = false;
      navigateInFlight = false;
      return;
    }
    if (attempts < maxAttempts) {
      setTimeout(tryNavigate, 250);
      return;
    }
    pendingIdDocumentNav = true;
    navigateInFlight = false;
  };
  tryNavigate();
}

function flushPending(canOpen: boolean): void {
  if (!canOpen || !pendingIdDocumentNav || navigateInFlight) return;
  navigateWhenReady();
}

/**
 * Opens Documents when the user taps an ID approved/rejected push.
 */
export function useNotificationOpenedIdDocumentNavigation(
  navReady: boolean
): void {
  const { auth, persona } = useStore();
  const handledInitial = useRef(false);
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

  const enrolled = persona.personas as PersonaSlug[];
  const active = persona.activePersona as PersonaSlug;
  const target = preferredPersona(active, enrolled);
  const canOpenDocs =
    auth.isAuthenticated &&
    persona.showMainApp &&
    (active === 'business' || active === 'agent');
  const canSwitch =
    auth.isAuthenticated &&
    persona.showMainApp &&
    target != null &&
    target !== active &&
    enrolled.includes(target) &&
    !persona.pickingPersona;

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromData = (data: Record<string, unknown> | undefined): void => {
      if (!isIdDocumentPush(data)) return;
      if (canOpenDocs) {
        navigateWhenReady();
        return;
      }
      pendingIdDocumentNav = true;
      if (canSwitch && target) {
        void persona.selectPersona(target);
      }
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        openFromData(data);
      }
    );

    if (!handledInitial.current) {
      handledInitial.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (!isIdDocumentPush(data)) return;
        openFromData(data);
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
    canOpenDocs,
    canSwitch,
    target,
    persona,
  ]);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      pendingIdDocumentNav = false;
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!navReady || !canOpenDocs) return;
    flushPending(canOpenDocs);
    const timer = setInterval(() => flushPending(canOpenDocs), 1000);
    return () => clearInterval(timer);
  }, [navReady, canOpenDocs, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPending(canOpenDocs);
    });
    return () => sub.remove();
  }, [canOpenDocs]);
}
