import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENT_LOCATION_LAST_SENT_KEY } from '../constants/agentLocationBackground';

export interface LastSentLocation {
  lat: number;
  lng: number;
  timestampMs: number;
  userId: string;
}

let stopGeneration = 0;

/**
 * Read the last-sent location for the given user.
 * Returns null if no record exists, the record is for a different user, or the record is invalid.
 * Legacy records without userId or timestampMs are treated as null (triggers immediate send after upgrade).
 */
export async function readLastSentLocation(
  userId: string
): Promise<LastSentLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(AGENT_LOCATION_LAST_SENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      lat?: number;
      lng?: number;
      timestampMs?: number;
      userId?: string;
    };
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.timestampMs !== 'number' ||
      typeof parsed.userId !== 'string'
    ) {
      return null;
    }
    if (parsed.userId !== userId) return null;
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      timestampMs: parsed.timestampMs,
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

/**
 * Write the last-sent location for the given user.
 * Ignores the write if tracking has been stopped since this save was initiated (generation mismatch).
 */
export async function writeLastSentLocation(
  lat: number,
  lng: number,
  timestampMs: number,
  userId: string,
  expectedGeneration: number
): Promise<void> {
  if (stopGeneration !== expectedGeneration) return;
  try {
    await AsyncStorage.setItem(
      AGENT_LOCATION_LAST_SENT_KEY,
      JSON.stringify({ lat, lng, timestampMs, userId })
    );
  } catch {
    /* ignore */
  }
}

/**
 * Clear the last-sent location and increment the stop generation to invalidate in-flight writes.
 */
export async function clearLastSentLocation(): Promise<void> {
  stopGeneration += 1;
  try {
    await AsyncStorage.removeItem(AGENT_LOCATION_LAST_SENT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Get the current stop generation (monotonically increasing counter).
 * Passed to writeLastSentLocation to detect stale writes.
 */
export function getStopGeneration(): number {
  return stopGeneration;
}
