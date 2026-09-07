import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

export type ManualUpdateCheckResult =
  | { kind: 'unsupported'; platform: 'web' | 'dev' | 'disabled' }
  | { kind: 'up_to_date' }
  | { kind: 'reloading' }
  | { kind: 'error'; message: string };

/**
 * Vérifie et applique une mise à jour OTA au démarrage de l'app.
 * En __DEV__ (Expo Go) on ne fait rien. En build (dev ou prod), on vérifie toujours.
 */
export function useExpoUpdatesOnStartup() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (__DEV__) return;
    ran.current = true;

    async function checkAndApply() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (__DEV__) {
          console.log('[expo-updates] checkForUpdateAsync', { isAvailable: update.isAvailable });
        }
        if (!update.isAvailable) return;

        const fetchResult = await Updates.fetchUpdateAsync();
        if (__DEV__) {
          console.log('[expo-updates] fetchUpdateAsync', { isNew: fetchResult.isNew });
        }
        if (fetchResult.isNew) {
          await Updates.reloadAsync();
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[expo-updates] checkAndApply failed', err);
        }
      }
    }

    checkAndApply();
  }, []);
}

/** Manual OTA check (menu). Not available on web, in Expo Go, or when updates are disabled. */
export async function checkForUpdateManually(): Promise<ManualUpdateCheckResult> {
  if (Platform.OS === 'web') return { kind: 'unsupported', platform: 'web' };
  if (__DEV__) return { kind: 'unsupported', platform: 'dev' };
  if (!Updates.isEnabled) return { kind: 'unsupported', platform: 'disabled' };

  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) return { kind: 'up_to_date' };

    const fetchResult = await Updates.fetchUpdateAsync();
    if (fetchResult.isNew) {
      await Updates.reloadAsync();
      return { kind: 'reloading' };
    }
    return { kind: 'up_to_date' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'error', message: message || 'check_failed' };
  }
}
