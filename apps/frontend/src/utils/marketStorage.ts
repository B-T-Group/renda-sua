import type { MarketSelectionMode, StoredMarket } from '../types/market';
import { MARKET_STORAGE_KEY } from '../types/market';
import { DETECTED_COUNTRY_STORAGE_KEY } from '../hooks/useDetectedCountry';

export function readStoredMarket(): StoredMarket | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MARKET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMarket;
    if (!parsed.countryCode) return null;
    return {
      countryCode: parsed.countryCode.toUpperCase(),
      stateCode: parsed.stateCode ?? null,
      mode: parsed.mode ?? 'MANUAL',
    };
  } catch {
    return null;
  }
}

export function writeStoredMarket(value: StoredMarket): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    MARKET_STORAGE_KEY,
    JSON.stringify({
      countryCode: value.countryCode.toUpperCase(),
      stateCode: value.stateCode ?? null,
      mode: value.mode,
    })
  );
}

export function readBootstrapCountryCode(): string | null {
  const stored = readStoredMarket()?.countryCode;
  if (stored) return stored;
  if (typeof window === 'undefined') return null;
  const detected = localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY);
  return detected?.toUpperCase() ?? null;
}

export function defaultMarketMode(): MarketSelectionMode {
  return readStoredMarket()?.mode ?? 'AUTO';
}
