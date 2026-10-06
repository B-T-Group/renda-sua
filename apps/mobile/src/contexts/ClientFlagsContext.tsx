import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { registerEnvChangeListener } from '../config/envSwitch';
import {
  DEFAULT_CLIENT_FLAGS,
  fetchClientFlags,
  type ClientFlags,
} from '../services/clientFlagsApi';
import { useStore } from '../stores/RootStore';
import {
  createClientFlagsLoader,
  watchMarketCountry,
  type ClientFlagsLoader,
  type ClientFlagsLoaderState,
} from './clientFlagsLoader';

type ClientFlagsContextValue = {
  flags: ClientFlags;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ClientFlagsContext = createContext<ClientFlagsContextValue>({
  flags: DEFAULT_CLIENT_FLAGS,
  loading: true,
  refresh: async () => undefined,
});

/**
 * Fetches client flags for the selected market. Logic lives in
 * `clientFlagsLoader.ts` (unit-tested): refetch on market change via a MobX
 * reaction, latest request wins, last known flags kept on failure.
 */
export function ClientFlagsProvider({ children }: { children: React.ReactNode }) {
  const { market } = useStore();
  const [state, setState] = useState<ClientFlagsLoaderState>({
    flags: DEFAULT_CLIENT_FLAGS,
    loading: true,
  });
  const loaderRef = useRef<ClientFlagsLoader | null>(null);
  // Seed a recreated loader (e.g. StrictMode remount) with the latest flags.
  const latestFlagsRef = useRef(state.flags);
  latestFlagsRef.current = state.flags;

  useEffect(() => {
    const loader = createClientFlagsLoader(fetchClientFlags, setState, latestFlagsRef.current);
    loaderRef.current = loader;
    const stopMarket = watchMarketCountry(market, (countryCode) => {
      void loader.setCountry(countryCode);
    });
    const stopEnv = registerEnvChangeListener(() => {
      void loader.refresh();
    });
    return () => {
      stopMarket();
      stopEnv();
      loader.dispose();
      if (loaderRef.current === loader) loaderRef.current = null;
    };
  }, [market]);

  const refresh = useCallback(async () => {
    await loaderRef.current?.refresh();
  }, []);

  const value = useMemo(
    () => ({ flags: state.flags, loading: state.loading, refresh }),
    [state.flags, state.loading, refresh]
  );

  return (
    <ClientFlagsContext.Provider value={value}>
      {children}
    </ClientFlagsContext.Provider>
  );
}

export function useClientFlags(): ClientFlagsContextValue {
  return useContext(ClientFlagsContext);
}
