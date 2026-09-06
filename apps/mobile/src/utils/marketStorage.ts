import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MarketSelectionMode } from '../types/market';

const MARKET_KEY = '@RendasuaAgent:market:selected_v2';
const PROMPT_DISMISSED_KEY = '@RendasuaAgent:market:promptDismissed';

export interface StoredMarket {
  countryCode: string;
  /** null = browse all states; non-null = narrowed to a specific state. */
  stateCode: string | null;
  mode: MarketSelectionMode;
}

export async function writeStoredMarket(data: StoredMarket): Promise<void> {
  await AsyncStorage.setItem(MARKET_KEY, JSON.stringify(data));
}

export async function readStoredMarket(): Promise<StoredMarket | null> {
  try {
    const raw = await AsyncStorage.getItem(MARKET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMarket;
    if (parsed?.countryCode && parsed?.mode) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function clearStoredMarket(): Promise<void> {
  await AsyncStorage.removeItem(MARKET_KEY);
}

export async function writePromptDismissed(countryCode: string): Promise<void> {
  await AsyncStorage.setItem(PROMPT_DISMISSED_KEY, countryCode);
}

export async function readPromptDismissed(): Promise<string | null> {
  return AsyncStorage.getItem(PROMPT_DISMISSED_KEY);
}

export async function clearPromptDismissed(): Promise<void> {
  await AsyncStorage.removeItem(PROMPT_DISMISSED_KEY);
}
