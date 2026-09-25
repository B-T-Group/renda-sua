import { useEffect, useState } from 'react';
import { probePasswordLoginEndpoint } from '../utils/authGatePasswordAvailability';
import { useApiClient } from './useApiClient';

export function useAuthGatePasswordAvailability(open: boolean) {
  const apiClient = useApiClient();
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) {
      setAvailable(null);
      return;
    }
    let cancelled = false;
    void probePasswordLoginEndpoint(apiClient).then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [apiClient, open]);

  return available;
}
