/**
 * Canal Android pour les notifications (requis pour afficher les notifications).
 * N’importe pas `expo-notifications` au chargement du bundle (Expo Go SDK 53+).
 */

import { Platform } from 'react-native';
import { loadExpoNotifications } from './expoNotificationsLoader';

type NotificationsModule = NonNullable<
  Awaited<ReturnType<typeof loadExpoNotifications>>
>;

/** Alarm stream so the backup notification is audible in vibrate/silent mode. */
function alarmChannel(Notifications: NotificationsModule, name: string) {
  return {
    name,
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default' as const,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    bypassDnd: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
  };
}

const DEFAULT_CHANNEL_ID = 'default';
/** New ids: Android will not change sound on a channel that already exists. */
export const ORDER_OFFERS_CHANNEL_ID = 'order_offers_alarm';
export const ORDER_UPDATES_CHANNEL_ID = 'order_updates';
export const BUSINESS_TRANSFERS_CHANNEL_ID = 'business_transfers';
export const ORDER_INCOMING_CHANNEL_ID = 'order_incoming_alarm';

export const PushNotificationService = {
  setupAndroidChannel: async (): Promise<void> => {
    if (Platform.OS !== 'android') return;
    const Notifications = await loadExpoNotifications();
    if (!Notifications) return;
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    // High-priority channel for incoming delivery offers so they interrupt the
    // agent (heads-up notification + sound + vibration) even when backgrounded.
    await Notifications.setNotificationChannelAsync(
      ORDER_OFFERS_CHANNEL_ID,
      alarmChannel(Notifications, 'Delivery offers')
    );
    await Notifications.setNotificationChannelAsync(
      ORDER_INCOMING_CHANNEL_ID,
      alarmChannel(Notifications, 'Incoming orders')
    );
    // Client order milestones (confirmed, ready for pickup, etc.).
    await Notifications.setNotificationChannelAsync(ORDER_UPDATES_CHANNEL_ID, {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync(
      BUSINESS_TRANSFERS_CHANNEL_ID,
      {
        name: 'Location transfers',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      }
    );
  },
};
