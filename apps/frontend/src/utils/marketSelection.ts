import type { Market } from '../types/market';
import { writeStoredMarket } from './marketStorage';

const FALLBACK_MARKET_FIELDS = {
  stateCode: null,
  stateName: null,
  currency: '',
  isEnabled: true,
} as const;

export function buildSelectedMarket(
  markets: Market[],
  countryCode: string,
  stateCode: string | null
): Market {
  const country = markets.find((m) => m.countryCode === countryCode);
  const base =
    country ??
    ({
      ...FALLBACK_MARKET_FIELDS,
      id: countryCode,
      code: countryCode,
      countryCode,
      name: countryCode,
      flag: countryCode,
    } as Market);
  return {
    ...base,
    stateCode,
    stateName: stateCode,
    id: stateCode ? `${countryCode}:${stateCode}` : countryCode,
  };
}

export function applyAutoDetectedCountry(
  raw: string | null | undefined,
  supportedIsos: string[],
  setCountryCode: (code: string) => void,
  setStateCode: (state: string | null) => void
): void {
  const code = raw?.toUpperCase();
  if (!code || !supportedIsos.includes(code)) return;
  setCountryCode(code);
  setStateCode(null);
  writeStoredMarket({ countryCode: code, stateCode: null, mode: 'AUTO' });
}
