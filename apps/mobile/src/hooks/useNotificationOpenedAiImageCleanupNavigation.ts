import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { loadExpoNotifications } from '../services/expoNotificationsLoader';
import { navigateToAiImageCleanupFromPush } from '../navigation/rootNavigationRef';
import { useStore } from '../stores/RootStore';

let pendingJobFromNotification: string | null = null;

function parseJobId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const type = typeof data.type === 'string' ? data.type : '';
  const looksCleanup =
    type === 'ai_image_cleanup_ready' || type.startsWith('ai_image_cleanup');
  const raw = data.jobId;
  if (typeof raw === 'string' && raw.trim()) {
    if (looksCleanup || type === '') return raw.trim();
  }
  if (!looksCleanup) return null;
  const url = data.url;
  if (typeof url === 'string') {
    const m = url.match(/ai-image-cleanup\/([0-9a-f-]{36})/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

function navigateWhenReady(jobId: string, maxAttempts = 24): void {
  let attempts = 0;
  const tryNavigate = () => {
    attempts += 1;
    if (navigateToAiImageCleanupFromPush(jobId)) return;
    if (attempts < maxAttempts) {
      setTimeout(tryNavigate, 250);
      return;
    }
    pendingJobFromNotification = jobId;
  };
  tryNavigate();
}

function flushPending(canOpen: boolean): void {
  if (!canOpen) return;
  const pending = pendingJobFromNotification;
  if (!pending) return;
  pendingJobFromNotification = null;
  navigateWhenReady(pending);
}

/**
 * Opens AI image cleanup review when the user taps a ready push.
 * Switches to the business persona first when another persona is active.
 */
export function useNotificationOpenedAiImageCleanupNavigation(
  navReady: boolean
): void {
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

  const canOpenBusinessApp =
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

    const openFromResponse = (data: Record<string, unknown> | undefined): void => {
      const jobId = parseJobId(data);
      if (!jobId) return;
      if (canOpenBusinessApp) {
        navigateWhenReady(jobId);
        return;
      }
      pendingJobFromNotification = jobId;
      if (canSwitchToBusiness) {
        void persona.selectPersona('business');
      }
    };

    const sub = notificationsMod.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        openFromResponse(data);
      }
    );

    if (!handledInitialResponse.current) {
      handledInitialResponse.current = true;
      void notificationsMod.getLastNotificationResponseAsync().then((last) => {
        if (!last) return;
        const data = last.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        if (parseJobId(data) === null) return;
        openFromResponse(data);
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
    canOpenBusinessApp,
    canSwitchToBusiness,
    persona,
  ]);

  useEffect(() => {
    if (!navReady) return;
    flushPending(canOpenBusinessApp);
  }, [navReady, canOpenBusinessApp, persona.activePersona]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushPending(canOpenBusinessApp);
    });
    return () => sub.remove();
  }, [canOpenBusinessApp]);
}
