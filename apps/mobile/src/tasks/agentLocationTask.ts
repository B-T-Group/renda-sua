/**
 * Background location task — must be registered at app entry (see index.js).
 * Sends fixes to Hasura when the OS delivers batched location updates.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY,
  AGENT_LOCATION_BG_ACTIVE_KEY,
  AUTH_STORAGE_IS_AUTHENTICATED_KEY,
  AGENT_LOCATION_TASK_NAME,
} from '../constants/agentLocationBackground';
import { updateMyAgentLocation } from '../services/agentLocationHasura';
import { readLastSentCoords, writeLastSentCoords } from '../utils/agentLocationLastSentStorage';
import { haversineDistanceM } from '../utils/haversineDistanceM';

const IDLE_MIN_DISTANCE_M = 100;
const ACTIVE_MIN_DISTANCE_M = 50;

TaskManager.defineTask(AGENT_LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: LocationObject[] })?.locations;
  if (!locations?.length) return;

  try {
    const bg = await AsyncStorage.getItem(AGENT_LOCATION_BG_ACTIVE_KEY);
    if (bg !== '1') return;

    const authed = await AsyncStorage.getItem(AUTH_STORAGE_IS_AUTHENTICATED_KEY);
    if (authed !== 'true') return;

    const latest = locations[locations.length - 1];
    const { latitude, longitude } = latest.coords;
    const activeDelivery =
      (await AsyncStorage.getItem(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)) === '1';
    const minDistance = activeDelivery ? ACTIVE_MIN_DISTANCE_M : IDLE_MIN_DISTANCE_M;

    const prev = await readLastSentCoords();
    if (prev) {
      const d = haversineDistanceM(prev.lat, prev.lng, latitude, longitude);
      if (d < minDistance) return;
    }

    const res = await updateMyAgentLocation(latitude, longitude);
    if (!res.success) return;
    await writeLastSentCoords(latitude, longitude);
  } catch {
    /* avoid throwing from task worker */
  }
});
