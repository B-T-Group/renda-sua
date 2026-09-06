import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const RS_ANON_ID_STORAGE_KEY = '@RendasuaAgent:rs_anon_id';

let cachedAnonymousId: string | null = null;

/**
 * Returns a stable per-install anonymous id used to deduplicate item-view
 * tracking for guests. Persisted via AsyncStorage and memoized in-process.
 */
export async function getOrCreateRsAnonymousId(): Promise<string> {
  if (cachedAnonymousId) return cachedAnonymousId;
  try {
    const existing = await AsyncStorage.getItem(RS_ANON_ID_STORAGE_KEY);
    if (existing) {
      cachedAnonymousId = existing;
      return existing;
    }
    const generated = randomUUID();
    await AsyncStorage.setItem(RS_ANON_ID_STORAGE_KEY, generated);
    cachedAnonymousId = generated;
    return generated;
  } catch {
    const fallback = `anon-${Math.random().toString(36).slice(2)}`;
    cachedAnonymousId = fallback;
    return fallback;
  }
}
