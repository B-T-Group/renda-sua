import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY,
  AGENT_LOCATION_BG_ACTIVE_KEY,
  AGENT_LOCATION_TASK_NAME,
} from '../constants/agentLocationBackground';

const DEFAULT_UPDATE_INTERVAL_MS = 20 * 60 * 1000;
const ACTIVE_UPDATE_INTERVAL_MS = 60 * 1000;
const MIN_DISTANCE_CHANGE_M = 100;
const ACTIVE_MIN_DISTANCE_M = 50;

let lastActiveDeliveryMode: boolean | null = null;

export function buildLocationTaskOptions(
  notificationTitle: string,
  notificationBody: string,
  options?: { activeDelivery?: boolean }
): Location.LocationTaskOptions {
  const active = !!options?.activeDelivery;
  const intervalMs = active
    ? ACTIVE_UPDATE_INTERVAL_MS
    : DEFAULT_UPDATE_INTERVAL_MS;
  const distanceM = active ? ACTIVE_MIN_DISTANCE_M : MIN_DISTANCE_CHANGE_M;
  const base: Location.LocationTaskOptions = {
    accuracy: active ? Location.Accuracy.High : Location.Accuracy.Balanced,
    distanceInterval: distanceM,
    deferredUpdatesDistance: distanceM,
    deferredUpdatesInterval: intervalMs,
    showsBackgroundLocationIndicator: true,
  };
  if (Platform.OS === 'android') {
    base.foregroundService = {
      notificationTitle,
      notificationBody,
    };
  }
  return base;
}

export async function markBackgroundTrackingActive(
  activeDelivery = false
): Promise<void> {
  await AsyncStorage.setItem(AGENT_LOCATION_BG_ACTIVE_KEY, '1');
  if (activeDelivery) {
    await AsyncStorage.setItem(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY, '1');
  } else {
    await AsyncStorage.removeItem(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY);
  }
}

export async function markBackgroundTrackingInactive(): Promise<void> {
  await AsyncStorage.multiRemove([
    AGENT_LOCATION_BG_ACTIVE_KEY,
    AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY,
  ]);
  lastActiveDeliveryMode = null;
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  await markBackgroundTrackingInactive();
  if (Platform.OS === 'web') return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(
      AGENT_LOCATION_TASK_NAME
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(AGENT_LOCATION_TASK_NAME);
    }
  } catch {
    /* ignore */
  }
}

export async function startBackgroundLocationUpdates(
  notificationTitle: string,
  notificationBody: string,
  options?: { activeDelivery?: boolean }
): Promise<void> {
  if (Platform.OS === 'web') return;
  const activeDelivery = !!options?.activeDelivery;
  const has = await Location.hasStartedLocationUpdatesAsync(
    AGENT_LOCATION_TASK_NAME
  );
  if (has && lastActiveDeliveryMode === activeDelivery) return;

  const taskOptions = buildLocationTaskOptions(
    notificationTitle,
    notificationBody,
    { activeDelivery }
  );

  // Prefer starting the new config first; only stop the old task after success
  // when Expo requires a restart (already running with different options).
  if (has) {
    try {
      await Location.stopLocationUpdatesAsync(AGENT_LOCATION_TASK_NAME);
    } catch {
      /* ignore */
    }
  }

  await markBackgroundTrackingActive(activeDelivery);
  try {
    await Location.startLocationUpdatesAsync(AGENT_LOCATION_TASK_NAME, taskOptions);
    lastActiveDeliveryMode = activeDelivery;
  } catch (error: unknown) {
    // Attempt to restore previous mode if restart failed mid-switch.
    if (has && lastActiveDeliveryMode != null) {
      try {
        await markBackgroundTrackingActive(lastActiveDeliveryMode);
        await Location.startLocationUpdatesAsync(
          AGENT_LOCATION_TASK_NAME,
          buildLocationTaskOptions(notificationTitle, notificationBody, {
            activeDelivery: lastActiveDeliveryMode,
          })
        );
      } catch {
        await markBackgroundTrackingInactive();
      }
    } else {
      await markBackgroundTrackingInactive();
    }
    throw error;
  }
}
