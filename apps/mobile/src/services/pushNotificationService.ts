/**
 * Canal Android pour les notifications (requis pour afficher les notifications).
 * N’importe pas `expo-notifications` au chargement du bundle (Expo Go SDK 53+).
 */

import { Platform } from 'react-native';
import { loadExpoNotifications } from './expoNotificationsLoader';

const DEFAULT_CHANNEL_ID = 'default';
export const ORDER_OFFERS_CHANNEL_ID = 'order_offers';
export const ORDER_UPDATES_CHANNEL_ID = 'order_updates';
export const BUSINESS_TRANSFERS_CHANNEL_ID = 'business_transfers';
export const ORDER_INCOMING_CHANNEL_ID = 'order_incoming';

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
    await Notifications.setNotificationChannelAsync(ORDER_OFFERS_CHANNEL_ID, {
      name: 'Delivery offers',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      bypassDnd: false,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    // Merchant incoming orders — new channel so existing installs pick up sound
    // (Android does not raise importance/sound on an already-created channel).
    await Notifications.setNotificationChannelAsync(ORDER_INCOMING_CHANNEL_ID, {
      name: 'Incoming orders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      bypassDnd: false,
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
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
