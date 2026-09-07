import { useMemo } from 'react';
import { useStore } from '../stores/RootStore';
import { useSupportedCountries } from './useSupportedCountries';
import { toMarket, type Market, type MarketSelectionMode } from '../types/market';
import { isoToFlagEmoji } from '../utils/countryFlagEmoji';

export interface UseMarketResult {
  /** The currently active Market object, or null while the store is still hydrating. */
  selectedMarket: Market | null;
  /** All enabled country-level markets available for selection. */
  markets: Market[];
  /** Selection mode: AUTO (follows detection) or MANUAL (user-chosen). */
  mode: MarketSelectionMode;
  /** ISO-2 code of the country detected in the background (may differ from selected). */
  detectedCountryCode: string | null;
  /** State detected in the background (may differ from selected state). */
  detectedStateCode: string | null;
  /** State code for a pending "switch market?" prompt. Null when no prompt needed. */
  pendingPromptCountry: string | null;
  /** Whether the market store has finished hydrating from storage. */
  hydrated: boolean;
  /**
   * Select a market. Pass stateCode=null to browse the whole country,
   * or a specific state string to narrow results (sets mode = MANUAL).
   */
  setMarket: (countryCode: string, stateCode?: string | null) => Promise<void>;
  /** Accept the pending switch prompt (sets mode back to AUTO). */
  acceptPrompt: () => Promise<void>;
  /** Dismiss the pending switch prompt for the detected country. */
  dismissPrompt: () => Promise<void>;
  /** Re-run background detection (respects MANUAL guard). */
  backgroundDetect: () => Promise<void>;
}

/** Minimal market built from just an ISO-2 code, used before the countries API responds. */
function fallbackMarket(countryCode: string, stateCode: string | null): Market {
  return {
    id: countryCode,
    code: countryCode,
    countryCode,
    stateCode,
    stateName: stateCode,
    name: countryCode,
    currency: '',
    flag: isoToFlagEmoji(countryCode),
    isEnabled: true,
  };
}

export function useMarket(): UseMarketResult {
  const { market } = useStore();
  const { countries } = useSupportedCountries();

  const markets = useMemo<Market[]>(
    () => countries.map(toMarket).filter((m) => m.isEnabled),
    [countries]
  );

  const selectedMarket = useMemo<Market | null>(() => {
    if (!market.hydrated) return null;
    const country = markets.find((m) => m.countryCode === market.selectedCountryCode);
    if (!country) {
      return fallbackMarket(market.selectedCountryCode, market.selectedStateCode);
    }
    // Build a market combining the country metadata with the selected state.
    return {
      ...country,
      stateCode: market.selectedStateCode,
      stateName: market.selectedStateCode,
      id: market.selectedStateCode
        ? `${country.countryCode}:${market.selectedStateCode}`
        : country.countryCode,
    };
  }, [market.hydrated, market.selectedCountryCode, market.selectedStateCode, markets]);

  const backgroundDetect = useMemo(
    () => () =>
      market.backgroundDetect(countries.map((c) => c.code.toUpperCase())),
    [market, countries]
  );

  return {
    selectedMarket,
    markets,
    mode: market.mode,
    detectedCountryCode: market.detectedCountryCode,
    detectedStateCode: market.detectedStateCode,
    pendingPromptCountry: market.pendingPromptCountry,
    hydrated: market.hydrated,
    setMarket: market.setMarket,
    acceptPrompt: market.acceptPrompt,
    dismissPrompt: market.dismissPrompt,
    backgroundDetect,
  };
}
