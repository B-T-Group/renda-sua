import { useAuth0 } from '@auth0/auth0-react';
import { useMemo } from 'react';
import { DETECTED_COUNTRY_STORAGE_KEY } from './useDetectedCountry';
import { useSupportedCountries } from './useSupportedCountries';

/** Same anonymous country hint as inventory; logged-in users rely on server primary address. */
export function useRentalCatalogGeoParams(): {
  country_code?: string;
  state?: string;
} {
  const { isAuthenticated } = useAuth0();
  const { supportedIsos } = useSupportedCountries();

  return useMemo(() => {
    if (isAuthenticated) {
      return {};
    }
    const detected =
      typeof window !== 'undefined'
        ? localStorage.getItem(DETECTED_COUNTRY_STORAGE_KEY)
        : null;
    const code = detected?.toUpperCase();
    if (code && supportedIsos.includes(code)) {
      return { country_code: code };
    }
    return {};
  }, [isAuthenticated, supportedIsos]);
}
