import StorageService from '../services/storage/StorageService';
import { STORAGE_KEYS } from '../constants/storageKeys';

export interface FirstOrderPin {
  orderId: string;
  pinnedAt: string;
}

export type FirstOrderPinRecord = Record<string, FirstOrderPin>;

let cached: FirstOrderPinRecord | null = null;

export function getCachedFirstOrderPins(): FirstOrderPinRecord {
  return cached ?? {};
}

export async function hydrateFirstOrderJourneyPins(): Promise<void> {
  try {
    const raw = await StorageService.getObject<FirstOrderPinRecord>(
      STORAGE_KEYS.firstOrderJourney
    );
    cached = raw ?? {};
  } catch {
    cached = {};
  }
}

async function persistPins(record: FirstOrderPinRecord): Promise<void> {
  cached = record;
  await StorageService.setObject(STORAGE_KEYS.firstOrderJourney, record);
}

export async function pinFirstOrder(
  businessId: string,
  orderId: string
): Promise<void> {
  const next = { ...getCachedFirstOrderPins() };
  next[businessId] = { orderId, pinnedAt: new Date().toISOString() };
  await persistPins(next);
}

export async function clearFirstOrderPin(businessId: string): Promise<void> {
  const next = { ...getCachedFirstOrderPins() };
  delete next[businessId];
  await persistPins(next);
}

export async function resetAllFirstOrderPins(): Promise<void> {
  await persistPins({});
}
