/**
 * Synchronise le token Expo Push avec le backend Nest (REST).
 * Après login / hydrate : GET /notifications/push-token/status puis POST /notifications/push-token si besoin.
 * En Expo Go (SDK 53+), les push distantes ne sont pas disponibles : on n’importe pas le module natif.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { agentApi } from './agentApi';
import { PushNotificationService } from './pushNotificationService';
import { loadExpoNotifications } from './expoNotificationsLoader';

let notificationHandlerConfigured = false;

/** Configure foreground notification presentation as early as possible (before token sync). */
export async function ensureDefaultNotificationHandler(): Promise<void> {
  if (notificationHandlerConfigured) return;
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return;
  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const isOfferOverlay =
        data?.type === 'order_offer' ||
        data?.type === 'stock_availability_check';
      const isOrderStatus = data?.type === 'order_status';
      const event = typeof data?.event === 'string' ? data.event : '';
      const isNewBusinessOrder =
        event === 'order_created' ||
        event === 'order_acceptance_activate' ||
        event === 'order_acceptance_reminder';
      const playSound = isOfferOverlay || isOrderStatus || isNewBusinessOrder;
      return {
        // Full-screen interrupts own the UX; hide the system banner for those.
        shouldShowAlert: !isOfferOverlay,
        shouldPlaySound: playSound,
        shouldSetBadge: true,
        shouldShowBanner: !isOfferOverlay,
        shouldShowList: true,
      };
    },
  });
}

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function resolveExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  await ensureDefaultNotificationHandler();
  const Notifications = await loadExpoNotifications();
  if (!Notifications) return null;

  await PushNotificationService.setupAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = getExpoProjectId();
  try {
    const res = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = res.data?.trim();
    return token || null;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('[push] getExpoPushTokenAsync failed', reason);
    return null;
  }
}

export async function syncExpoPushTokenWithBackend(): Promise<{ pushToken: string } | null> {
  try {
    const expoPushToken = await resolveExpoPushToken();
    if (!expoPushToken) return null;

    const status = await agentApi.notifications.getPushTokenStatus(expoPushToken);
    if (!status.success) {
      console.warn('[push] status failed', status.error);
      return null;
    }

    if (status.currentTokenRegistered === true) {
      return { pushToken: expoPushToken };
    }

    const registered = await agentApi.notifications.registerPushToken({ expoPushToken });
    if (!registered.success) {
      console.warn('[push] register failed', registered.error);
      return null;
    }
    return { pushToken: expoPushToken };
  } catch (e) {
    console.warn('[push] sync failed', e instanceof Error ? e.message : e);
    return null;
  }
}

export const NotificationRegistrationService = {
  registerPushToken(
    _updatePushToken: (token: string) => Promise<unknown>,
    _apolloClient: unknown
  ): Promise<{ pushToken: string } | null> {
    return syncExpoPushTokenWithBackend();
  },
  reset: (): void => {},
};
