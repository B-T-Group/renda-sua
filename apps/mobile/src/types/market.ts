import { isoToFlagEmoji } from '../utils/countryFlagEmoji';
import type { SupportedCountry } from '../services/supportedCountriesApi';

export type MarketSelectionMode = 'AUTO' | 'MANUAL';

/**
 * A state/region within a market (e.g. "Littoral" inside Cameroon).
 * Returned by GET /locations/market-states with the live item count.
 */
export interface MarketState {
  /** Raw state value as stored in addresses.state on the backend. */
  state: string;
  /** Number of active inventory items in this state. */
  itemCount: number;
}

/**
 * A Market is the unit of catalog browsing.
 * Today: 1 Market = 1 country (stateCode is null → browse the whole country).
 * Future: stateCode points to a sub-market (e.g. Douala, Yaoundé).
 *
 * The id/code/countryCode fields all hold the ISO-2 country code today.
 * When sub-markets exist, id becomes "{countryCode}:{stateCode}" while
 * countryCode and stateCode stay separate — only the toMarket mapper needs updating.
 */
export interface Market {
  /** Unique market identifier. Today = countryCode, future = "CM:DLA". */
  id: string;
  /** ISO-2 country code (e.g. "CM"). */
  code: string;
  /** ISO-2 country code this market belongs to. */
  countryCode: string;
  /** Optional state/region within the country (null = all states). */
  stateCode: string | null;
  /** Human-readable state name (null when stateCode is null). */
  stateName: string | null;
  /** Display name (e.g. "Cameroon" or "Douala, Cameroon"). */
  name: string;
  /** ISO-4217 currency code (e.g. "XAF", "CAD"). */
  currency: string;
  /** Flag emoji derived from the country code. */
  flag: string;
  /** Whether this market is open for service. */
  isEnabled: boolean;
  /** Live count of active items in this market (populated from market-states API). */
  itemCount?: number;
}

/** Build a country-level Market (stateCode = null → all states). */
export function toMarket(country: SupportedCountry): Market {
  return {
    id: country.code.toUpperCase(),
    code: country.code.toUpperCase(),
    countryCode: country.code.toUpperCase(),
    stateCode: null,
    stateName: null,
    name: country.name,
    currency: country.currencyCode,
    flag: isoToFlagEmoji(country.code),
    isEnabled: country.serviceStatus === 'active',
  };
}

export const DEFAULT_MARKET_CODE = 'CM';
