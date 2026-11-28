import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_MARKET_CODE,
  pickSupportedCountryCode,
  toMarket,
  type Market,
  type MarketSelectionMode,
} from '../types/market';
import {
  DETECTED_COUNTRY_EVENT,
  DETECTED_COUNTRY_STORAGE_KEY,
} from '../hooks/useDetectedCountry';
import {
  readBootstrapCountryCode,
  readStoredMarket,
  writeStoredMarket,
} from '../utils/marketStorage';
import {
  applyAutoDetectedCountry,
  buildSelectedMarket,
} from '../utils/marketSelection';
import { useSupportedCountries } from '../hooks/useSupportedCountries';
import { useApiClient } from '../hooks/useApiClient';
import { shouldClearMissingSavedState } from '../utils/savedMarketState';

export interface UseMarketResult {
  selectedMarket: Market | null;
  markets: Market[];
  mode: MarketSelectionMode;
  hydrated: boolean;
  setMarket: (countryCode: string, stateCode?: string | null) => void;
}

const MarketContext = createContext<UseMarketResult | null>(null);

export function MarketProvider({ children }: { children: ReactNode }) {
  const apiClient = useApiClient();
  const { countries, supportedIsos, loading: countriesLoading } =
    useSupportedCountries();
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
    if (countriesLoading) return;
    const code = pickSupportedCountryCode(
      readBootstrapCountryCode(),
      supportedIsos
    );
    setCountryCode(code);
    setStateCode(null);
    setMode('AUTO');
    writeStoredMarket({ countryCode: code, stateCode: null, mode: 'AUTO' });
    setHydrated(true);
  }, [supportedIsos, countriesLoading]);

  useEffect(() => {
    if (!hydrated || mode !== 'AUTO') return;
    const onDetected = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      applyAutoDetectedCountry(
        detail,
        supportedIsos,
        setCountryCode,
        setStateCode
      );
    };
    window.addEventListener(DETECTED_COUNTRY_EVENT, onDetected);
    applyAutoDetectedCountry(
      localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY),
      supportedIsos,
      setCountryCode,
      setStateCode
    );
    return () => {
      window.removeEventListener(DETECTED_COUNTRY_EVENT, onDetected);
    };
  }, [hydrated, mode, supportedIsos]);


  // Once market-states has loaded for the saved country, drop a saved state
  // that is no longer in the list (quietly, All of the country, same mode).
  useEffect(() => {
    if (!hydrated || !stateCode) return;
    const country = countryCode;
    const state = stateCode;
    const savedMode = mode;
    let active = true;
    apiClient
      .get<{ states?: Array<{ state: string }> }>('/locations/market-states', {
        params: { countryCode: country, catalog: 'all' },
      })
      .then((res) => {
        if (!active) return;
        const names = (res.data?.states ?? []).map((row) => row.state);
        if (
          !shouldClearMissingSavedState({
            countryCode: country,
            stateCode: state,
            knownStates: names,
            loaded: true,
            loading: false,
            loadFailed: false,
          })
        ) {
          return;
        }
        setStateCode(null);
        writeStoredMarket({
          countryCode: country,
          stateCode: null,
          mode: savedMode,
        });
      })
      .catch(() => {
        // Request failed — keep the saved state.
      });
    return () => {
      active = false;
    };
  }, [hydrated, countryCode, stateCode, mode, apiClient]);

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

  const value = useMemo(
    () => ({ selectedMarket, markets, mode, hydrated, setMarket }),
    [selectedMarket, markets, mode, hydrated, setMarket]
  );

  return (
    <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
  );
}

export function useMarket(): UseMarketResult {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
