import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { loadExpoNotifications } from '@/services/expoNotificationsLoader';

export interface NotificationPermissionState {
  status: 'granted' | 'denied' | 'undetermined' | null;
  isLoading: boolean;
  isDevice: boolean;
  canRequest: boolean;
  isExpoGoUnsupported?: boolean;
}

/** Real push permission state via expo-notifications (null when unavailable on web/Expo Go). */
export function useNotificationPermission() {
  const [state, setState] = useState<NotificationPermissionState>({
    status: null,
    isLoading: true,
    isDevice: Device.isDevice,
    canRequest: false,
    isExpoGoUnsupported: Platform.OS === 'web' || !Device.isDevice,
  });

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web' || !Device.isDevice) {
      setState({
        status: null,
        isLoading: false,
        isDevice: false,
        canRequest: false,
        isExpoGoUnsupported: true,
      });
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true }));
    const Notifications = await loadExpoNotifications();
    if (!Notifications) {
      setState({
        status: null,
        isLoading: false,
        isDevice: Device.isDevice,
        canRequest: false,
        isExpoGoUnsupported: true,
      });
      return null;
    }

    const { status } = await Notifications.getPermissionsAsync();
    setState({
      status,
      isLoading: false,
      isDevice: true,
      canRequest: status === 'undetermined',
      isExpoGoUnsupported: false,
    });
    return status;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    const Notifications = await loadExpoNotifications();
    if (!Notifications) return null;
    setState((prev) => ({ ...prev, isLoading: true }));
    const { status } = await Notifications.requestPermissionsAsync();
    setState({
      status,
      isLoading: false,
      isDevice: true,
      canRequest: status === 'undetermined',
      isExpoGoUnsupported: false,
    });
    return status;
  }, []);

  return {
    ...state,
    checkPermission: refresh,
    requestPermission,
    openSettings: () => {
      void import('react-native').then(({ Linking }) => Linking.openSettings());
    },
    isGranted: state.status === 'granted',
    isDenied: state.status === 'denied',
    isUndetermined: state.status === 'undetermined',
  };
}

export default useNotificationPermission;
