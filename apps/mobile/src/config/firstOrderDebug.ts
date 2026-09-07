import AsyncStorage from '@react-native-async-storage/async-storage';

export const FORCE_FIRST_ORDER_KEY = '@RendasuaAgent:forceFirstOrderGuidance';

let forced = false;
const listeners = new Set<() => void>();

export function isFirstOrderGuidanceForced(): boolean {
  return forced;
}

export function registerFirstOrderDebugListener(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export async function hydrateFirstOrderDebug(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(FORCE_FIRST_ORDER_KEY);
    forced = raw === 'true';
  } catch {
    forced = false;
  }
}

export async function persistFirstOrderGuidanceForced(on: boolean): Promise<void> {
  forced = on;
  notifyListeners();
  if (on) {
    await AsyncStorage.setItem(FORCE_FIRST_ORDER_KEY, 'true');
    return;
  }
  await AsyncStorage.removeItem(FORCE_FIRST_ORDER_KEY);
}
