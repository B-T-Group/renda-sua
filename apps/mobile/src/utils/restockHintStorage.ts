import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@Rendasua:restockAlerts:hintSeen';

export async function hasSeenRestockHint(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true; // never nag when storage is broken
  }
}

export async function markRestockHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // ignore
  }
}
