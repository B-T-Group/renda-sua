import AsyncStorage from '@react-native-async-storage/async-storage';
import { AGENT_LOCATION_LAST_SENT_KEY } from '../constants/agentLocationBackground';

export interface LastSentCoords {
  lat: number;
  lng: number;
}

export async function readLastSentCoords(): Promise<LastSentCoords | null> {
  try {
    const raw = await AsyncStorage.getItem(AGENT_LOCATION_LAST_SENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: number; lng?: number };
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

export async function writeLastSentCoords(lat: number, lng: number): Promise<void> {
  try {
    await AsyncStorage.setItem(
      AGENT_LOCATION_LAST_SENT_KEY,
      JSON.stringify({ lat, lng })
    );
  } catch {
    /* ignore */
  }
}

export async function clearLastSentCoords(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AGENT_LOCATION_LAST_SENT_KEY);
  } catch {
    /* ignore */
  }
}
