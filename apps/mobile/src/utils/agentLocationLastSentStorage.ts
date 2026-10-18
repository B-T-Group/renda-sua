import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENT_LOCATION_LAST_SENT_KEY } from '../constants/agentLocationBackground';

export interface LastSentLocation {
  lat: number;
  lng: number;
  timestampMs: number;
  userId: string;
}

/**
 * stopGeneration is a monotonic counter that increments each time tracking stops.
 * It prevents late async saves from writeLastSentLocation from landing after
 * clearLastSentLocation has already run (for example, when the user toggles consent
 * off or logs out while a send is in flight).
 * 
 * Note: This counter is per-JS-runtime, so it doesn't cross the Android headless
 * task boundary. That's acceptable because stopBackgroundLocationUpdates also stops
 * the task itself, so there's no separate runtime to race with.
 */
let stopGeneration = 0;

/**
 * In-flight send guard. While true, no new send should be initiated.
 * Prevents overlapping sends when network is slow or fixes arrive faster than sends complete.
 */
let sendInFlight = false;

/**
 * Timestamp of the last send attempt (successful or failed), used for failure backoff.
 * After a failed send, we wait at least FAILURE_BACKOFF_MS before retrying.
 */
let lastAttemptMs = 0;

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

/**
 * Check if a send is currently in flight.
 * If true, callers should skip the send to avoid overlapping requests.
 */
export function isSendInFlight(): boolean {
  return sendInFlight;
}

/**
 * Mark that a send is starting. Returns false if a send is already in flight.
 * Call endSend() in a finally block to clear the flag.
 */
export function beginSend(): boolean {
  if (sendInFlight) return false;
  sendInFlight = true;
  return true;
}

/**
 * Mark that a send has completed (successfully or failed).
 * Always call this in a finally block after beginSend() returns true.
 */
export function endSend(): void {
  sendInFlight = false;
}

/**
 * Record a send attempt (successful or failed) with the current timestamp.
 * Used for failure backoff logic.
 */
export function recordAttempt(): void {
  lastAttemptMs = Date.now();
}

/**
 * Check if enough time has passed since the last attempt to allow a retry
 * after a failed send. Returns true if at least backoffMs has passed.
 */
export function canRetryAfterFailure(backoffMs: number): boolean {
  if (lastAttemptMs === 0) return true;
  return Date.now() - lastAttemptMs >= backoffMs;
}
