import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { loadExpoNotifications } from '@/services/expoNotificationsLoader';

/** Syncs the OS app-icon badge with actions-needed + unread Activity count. */
export function useAppIconBadge(count: number) {
  const syncBadge = useCallback(async (next: number) => {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    const Notifications = await loadExpoNotifications();
    if (!Notifications?.setBadgeCountAsync) return;
    try {
      await Notifications.setBadgeCountAsync(Math.max(0, next));
    } catch {
      // Non-fatal — badge may be unsupported on some builds.
    }
  }, []);

  useEffect(() => {
    void syncBadge(count);
  }, [count, syncBadge]);
}
