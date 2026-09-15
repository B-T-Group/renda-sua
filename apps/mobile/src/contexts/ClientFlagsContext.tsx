import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { registerEnvChangeListener } from '../config/envSwitch';
import {
  DEFAULT_CLIENT_FLAGS,
  fetchClientFlags,
  type ClientFlags,
} from '../services/clientFlagsApi';

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

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchClientFlags();
    setFlags(next);
    setLoading(false);
  }, []);

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
