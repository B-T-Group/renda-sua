/**
 * Prompts authenticated users to enable push notifications when still undetermined.
 * Skips web, Expo Go, and simulators — push is unavailable there.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Device from 'expo-device';
import { useStore } from '../stores/RootStore';
import { useNotificationPermission } from './useNotificationPermission';

const PUSH_UNSUPPORTED = Platform.OS === 'web' || !Device.isDevice;

export const useCheckNotificationPermissionOnStart = () => {
  const { auth } = useStore();
  const navigation = useNavigation();
  const route = useRoute();
  const { checkPermission } = useNotificationPermission();
  const checkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (PUSH_UNSUPPORTED) return;
    if (!auth.isAuthenticated || !auth.user) return;
    if (route.name === 'NotificationPermission') return;

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    const checkAndRedirect = async () => {
      try {
        const currentStatus = await checkPermission();
        if (currentStatus === 'granted' || currentStatus == null) return;

        checkTimeoutRef.current = setTimeout(() => {
          try {
            const navState = (navigation as { getState?: () => { routes?: { name: string }[]; index?: number } }).getState?.();
            const currentRoute = navState?.routes?.[navState?.index ?? 0]?.name;
            if (currentRoute === 'NotificationPermission') return;
            (navigation as { navigate: (name: string) => void }).navigate(
              'NotificationPermission'
            );
          } catch (error: unknown) {
            console.error('[useCheckNotificationPermissionOnStart] navigate failed', error);
          }
        }, 1500);
      } catch (error: unknown) {
        console.error('[useCheckNotificationPermissionOnStart] check failed', error);
      }
    };

    checkTimeoutRef.current = setTimeout(() => {
      void checkAndRedirect();
    }, 500);

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [auth.isAuthenticated, auth.user, checkPermission, navigation, route.name]);
};

export default useCheckNotificationPermissionOnStart;
