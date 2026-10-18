import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENT_LOCATION_LAST_SENT_KEY } from '../constants/agentLocationBackground';

export interface LastSentLocation {
  lat: number;
  lng: number;
  timestampMs: number;
}

export async function readLastSentLocation(): Promise<LastSentLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(AGENT_LOCATION_LAST_SENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      lat?: number;
      lng?: number;
      timestampMs?: number;
    };
    if (
      typeof parsed.lat !== 'number' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.timestampMs !== 'number'
    ) {
      return null;
    }
    return { lat: parsed.lat, lng: parsed.lng, timestampMs: parsed.timestampMs };
  } catch {
    return null;
  }
}

export async function writeLastSentLocation(
  lat: number,
  lng: number,
  timestampMs: number
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      AGENT_LOCATION_LAST_SENT_KEY,
      JSON.stringify({ lat, lng, timestampMs })
    );
  } catch {
    /* ignore */
  }
}

export async function clearLastSentLocation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AGENT_LOCATION_LAST_SENT_KEY);
  } catch {
    /* ignore */
  }
}

export async function readLastSentCoords(): Promise<{ lat: number; lng: number } | null> {
  const location = await readLastSentLocation();
  return location ? { lat: location.lat, lng: location.lng } : null;
}

export async function writeLastSentCoords(lat: number, lng: number): Promise<void> {
  await writeLastSentLocation(lat, lng, Date.now());
}

export async function clearLastSentCoords(): Promise<void> {
  await clearLastSentLocation();
}
