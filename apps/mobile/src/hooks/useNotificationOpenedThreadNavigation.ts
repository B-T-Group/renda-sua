import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { navigateToThreadFromPush, rootNavigationRef } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';

let pendingThreadId: string | null = null;

function parseThreadPayload(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (data.type !== 'user_thread_message') return null;
  const raw = data.threadId;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

function tryOpenThread(threadId: string, canOpen: boolean): boolean {
  if (!canOpen || !rootNavigationRef.isReady()) return false;
  return navigateToThreadFromPush(threadId);
}

/**
 * Opens ThreadDetail when the user taps a user_thread_message push notification.
 */
export function useNotificationOpenedThreadNavigation(navReady: boolean): void {
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
    return () => { cancelled = true; };
  }, []);

  const canOpenMainApp =
    auth.isAuthenticated &&
    persona.showMainApp &&
    (persona.activePersona === 'client' ||
      persona.activePersona === 'agent' ||
      persona.activePersona === 'business');

  useEffect(() => {
    if (!notificationsMod || !navReady) return;

    const openFromData = (data: Record<string, unknown> | undefined): void => {
      const threadId = parseThreadPayload(data);
      if (!threadId) return;
      const opened = tryOpenThread(threadId, canOpenMainApp);
      if (!opened) pendingThreadId = threadId;
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      openFromData(data);
    });

    if (!handledInitial.current) {
      handledInitial.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as Record<string, unknown> | undefined;
        if (!parseThreadPayload(data)) return;
        openFromData(data);
        if (typeof notificationsMod.clearLastNotificationResponseAsync === 'function') {
          void notificationsMod.clearLastNotificationResponseAsync();
        }
      });
    }

    return () => sub.remove();
  }, [notificationsMod, navReady, canOpenMainApp]);

  useEffect(() => {
    if (!navReady || !canOpenMainApp || !pendingThreadId) return;
    if (tryOpenThread(pendingThreadId, true)) {
      pendingThreadId = null;
    }
  }, [navReady, canOpenMainApp, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !canOpenMainApp || !pendingThreadId) return;
      if (tryOpenThread(pendingThreadId, true)) {
        pendingThreadId = null;
      }
    });
    return () => sub.remove();
  }, [canOpenMainApp]);
}
