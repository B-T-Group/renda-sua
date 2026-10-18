/**
 * Background location task — must be registered at app entry (see index.js).
 * Sends fixes to Hasura when the OS delivers batched location updates.
 * 
 * iOS idle note: iOS uses a 100m distanceInterval filter, so a stationary agent
 * receives no background fixes and the heartbeat cannot fire. Foreground interval
 * provides the stationary heartbeat when the app is visible. iOS may also throttle
 * delivery even when moving, depending on battery state and system policies.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY,
  AGENT_LOCATION_BG_ACTIVE_KEY,
  AUTH_STORAGE_IS_AUTHENTICATED_KEY,
  AUTH_STORAGE_USER_KEY,
  AGENT_LOCATION_TASK_NAME,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_SLACK_MS,
} from '../constants/agentLocationBackground';
import { updateMyAgentLocation } from '../services/agentLocationHasura';
import {
  readLastSentLocation,
  writeLastSentLocation,
  getStopGeneration,
} from '../utils/agentLocationLastSentStorage';
import { haversineDistanceM } from '../utils/haversineDistanceM';
import { shouldSendLocation } from '../utils/shouldSendLocation';

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

    const userJson = await AsyncStorage.getItem(AUTH_STORAGE_USER_KEY);
    if (!userJson) return;
    const user = JSON.parse(userJson) as { id?: string };
    if (!user.id) return;

    const latest = locations[locations.length - 1];
    const { latitude, longitude } = latest.coords;
    const activeDelivery =
      (await AsyncStorage.getItem(AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY)) === '1';
    const minDistance = activeDelivery ? ACTIVE_MIN_DISTANCE_M : IDLE_MIN_DISTANCE_M;

    const generation = getStopGeneration();
    const prev = await readLastSentLocation(user.id);
    const nowMs = Date.now();

    const shouldSend = shouldSendLocation(
      prev,
      latitude,
      longitude,
      nowMs,
      minDistance,
      HEARTBEAT_INTERVAL_MS,
      HEARTBEAT_SLACK_MS,
      haversineDistanceM
    );

    if (!shouldSend) return;

    const res = await updateMyAgentLocation(latitude, longitude);
    if (!res.success) return;
    await writeLastSentLocation(latitude, longitude, nowMs, user.id, generation);
  } catch {
    /* avoid throwing from task worker */
  }
});
