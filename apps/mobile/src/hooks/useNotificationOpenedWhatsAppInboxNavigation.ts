import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { navigateToWhatsAppInboxFromPush } from '../navigation/rootNavigationRef';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { useStore } from '../stores/RootStore';
import { parseWhatsAppInboxPayload } from '../utils/parseWhatsAppInboxPayload';

/** Conversation id (or empty string for the inbox list) until the shell mounts. */
let pendingConversation: string | null = null;

function navigateWhenReady(conversationId: string, maxAttempts = 24): void {
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (navigateToWhatsAppInboxFromPush(conversationId || null)) {
      pendingConversation = null;
      return;
    }
    if (attempts < maxAttempts) setTimeout(tryNavigate, 250);
    else pendingConversation = conversationId;
  };
  tryNavigate();
}

function flushPending(canOpen: boolean): void {
  if (!canOpen || pendingConversation === null) return;
  const conversationId = pendingConversation;
  pendingConversation = null;
  navigateWhenReady(conversationId);
}

/**
 * Opens the WhatsApp inbox conversation when a staff user taps a
 * `whatsapp_inbox_message` push. The list is used when the id is missing.
 */
export function useNotificationOpenedWhatsAppInboxNavigation(
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

  const canOpenInbox =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona === 'business';

  const canSwitchToBusiness =
    auth.isAuthenticated &&
    persona.showMainApp &&
    persona.activePersona !== 'business' &&
    persona.personas.includes('business') &&
    !persona.pickingPersona;

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromData = (data: Record<string, unknown> | undefined): void => {
      const conversationId = parseWhatsAppInboxPayload(data);
      if (conversationId === null) return;
      if (canOpenInbox) {
        navigateWhenReady(conversationId);
        return;
      }
      pendingConversation = conversationId;
      if (canSwitchToBusiness) void persona.selectPersona('business');
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        openFromData(
          response.notification.request.content.data as
            | Record<string, unknown>
            | undefined
        );
      }
    );

    if (!handledInitial.current) {
      handledInitial.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseWhatsAppInboxPayload(data) === null) return;
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
    canOpenInbox,
    canSwitchToBusiness,
    persona,
  ]);

  useEffect(() => {
    if (!navReady) return;
    flushPending(canOpenInbox);
  }, [navReady, canOpenInbox, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPending(canOpenInbox);
    });
    return () => sub.remove();
  }, [canOpenInbox]);
}
