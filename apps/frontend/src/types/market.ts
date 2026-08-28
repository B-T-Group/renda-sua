export type MarketSelectionMode = 'AUTO' | 'MANUAL';

export interface MarketState {
  state: string;
  itemCount: number;
}

export interface Market {
  id: string;
  code: string;
  countryCode: string;
  stateCode: string | null;
  stateName: string | null;
  name: string;
  currency: string;
  flag: string;
  isEnabled: boolean;
}

export interface StoredMarket {
  countryCode: string;
  stateCode: string | null;
  mode: MarketSelectionMode;
}

export const MARKET_STORAGE_KEY = 'rendasua_market_v1';
export const DEFAULT_MARKET_CODE = 'CM';

export function pickSupportedCountryCode(
  preferred: string | null | undefined,
  supportedIsos: string[],
  fallback = DEFAULT_MARKET_CODE
): string {
  const upper = preferred?.toUpperCase();
  if (upper && supportedIsos.includes(upper)) return upper;
  if (supportedIsos.includes(fallback)) return fallback;
  return supportedIsos[0] ?? fallback;
}

export function isoToFlagEmoji(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return '??';
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export function toMarket(country: {
  code: string;
  name: string;
  currencyCode: string;
  serviceStatus: string;
}): Market {
  const upper = country.code.toUpperCase();
  return {
    id: upper,
    code: upper,
    countryCode: upper,
    stateCode: null,
    stateName: null,
    name: country.name,
    currency: country.currencyCode,
    flag: isoToFlagEmoji(upper),
    isEnabled: country.serviceStatus === 'active',
  };
}
