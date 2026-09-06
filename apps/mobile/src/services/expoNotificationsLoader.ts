/**
 * Loads `expo-notifications` only when supported. In **Expo Go** (SDK 53+), the
 * native module throws on Android when imported — avoid importing entirely.
 */

import Constants from 'expo-constants';

type ExpoNotificationsModule = typeof import('expo-notifications');

/**
 * The in-flight import is cached rather than a "already started" flag: every
 * notification hook calls this within the same effect flush, so a flag would
 * hand `null` to all callers but the first (the dynamic import has not settled
 * yet), permanently disabling their tap listeners.
 */
let loadPromise: Promise<ExpoNotificationsModule | null> | null = null;

export function isExpoGoApp(): boolean {
  return Constants.appOwnership === 'expo';
}

export function loadExpoNotifications(): Promise<ExpoNotificationsModule | null> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (isExpoGoApp()) return null;
    try {
      return await import('expo-notifications');
    } catch {
      return null;
    }
  })();
  return loadPromise;
}
