import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_MARKET_CODE,
  toMarket,
  type Market,
  type MarketSelectionMode,
} from '../types/market';
import {
  readBootstrapCountryCode,
  readStoredMarket,
  writeStoredMarket,
} from '../utils/marketStorage';
import { useSupportedCountries } from './useSupportedCountries';

export interface UseMarketResult {
  selectedMarket: Market | null;
  markets: Market[];
  mode: MarketSelectionMode;
  hydrated: boolean;
  setMarket: (countryCode: string, stateCode?: string | null) => void;
}

function buildSelectedMarket(
  markets: Market[],
  countryCode: string,
  stateCode: string | null
): Market {
  const country = markets.find((m) => m.countryCode === countryCode);
  const base =
    country ??
    ({
      id: countryCode,
      code: countryCode,
      countryCode,
      stateCode: null,
      stateName: null,
      name: countryCode,
      currency: '',
      flag: countryCode,
      isEnabled: true,
    } as Market);
  return {
    ...base,
    stateCode,
    stateName: stateCode,
    id: stateCode ? `${countryCode}:${stateCode}` : countryCode,
  };
}

export function useMarket(): UseMarketResult {
  const { countries, supportedIsos } = useSupportedCountries();
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_MARKET_CODE);
  const [stateCode, setStateCode] = useState<string | null>(null);
  const [mode, setMode] = useState<MarketSelectionMode>('AUTO');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredMarket();
    if (stored) {
      setCountryCode(stored.countryCode);
      setStateCode(stored.stateCode);
      setMode(stored.mode);
      setHydrated(true);
      return;
    }
    const bootstrap = readBootstrapCountryCode();
    const code =
      bootstrap && supportedIsos.includes(bootstrap)
        ? bootstrap
        : supportedIsos.includes(DEFAULT_MARKET_CODE)
          ? DEFAULT_MARKET_CODE
          : supportedIsos[0] ?? DEFAULT_MARKET_CODE;
    setCountryCode(code);
    setStateCode(null);
    setMode('AUTO');
    writeStoredMarket({ countryCode: code, stateCode: null, mode: 'AUTO' });
    setHydrated(true);
  }, [supportedIsos]);

  const markets = useMemo(
    () =>
      countries
        .map(toMarket)
        .filter((m) => m.isEnabled && supportedIsos.includes(m.countryCode)),
    [countries, supportedIsos]
  );

  const selectedMarket = useMemo(() => {
    if (!hydrated) return null;
    return buildSelectedMarket(markets, countryCode, stateCode);
  }, [hydrated, markets, countryCode, stateCode]);

  const setMarket = useCallback(
    (nextCountry: string, nextState: string | null = null) => {
      const upper = nextCountry.toUpperCase();
      setCountryCode(upper);
      setStateCode(nextState);
      setMode('MANUAL');
      writeStoredMarket({
        countryCode: upper,
        stateCode: nextState,
        mode: 'MANUAL',
      });
    },
    []
  );

  return { selectedMarket, markets, mode, hydrated, setMarket };
}
