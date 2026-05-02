import { useEffect, useState } from 'react';
import { getCountryStateCity } from '../utils/countryStateCityLoader';

export function useCountryStateCity() {
  const [module, setModule] = useState<
    typeof import('country-state-city') | null
  >(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    getCountryStateCity()
      .then((m) => {
        if (!cancelled) setModule(m);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    module,
    loading: !module && !error,
    error,
  };
}
