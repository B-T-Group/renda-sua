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
import { useMarket } from '../hooks/useMarket';

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

export function ClientFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<ClientFlags>(DEFAULT_CLIENT_FLAGS);
  const [loading, setLoading] = useState(true);
  const { selectedMarket } = useMarket();
  const requestIdRef = useRef(0);

  // Key refresh on the countryCode string to avoid double fetch on object rebuild
  const countryCode = selectedMarket?.countryCode;

  const refresh = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;

    try {
      const next = await fetchClientFlags(countryCode);
      // Ignore out-of-order responses
      if (requestId === requestIdRef.current) {
        setFlags(next);
      }
    } catch (error) {
      // On fetch failure, keep the previous flags (never reset to false)
      // catalog_experience_v1, floating_nav_enabled, reels_enabled are on in prod
      console.warn('Failed to fetch client flags, keeping previous state', error);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [countryCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => registerEnvChangeListener(() => {
    void refresh();
  }), [refresh]);

  const value = useMemo(
    () => ({ flags, loading, refresh }),
    [flags, loading, refresh]
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
