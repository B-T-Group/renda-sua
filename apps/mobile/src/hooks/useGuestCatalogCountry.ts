import { useMemo } from 'react';
import { getDeviceDefaultCountryCode } from '../utils/deviceDefaultCountry';
import { useSupportedCountries } from './useSupportedCountries';

export interface UseGuestCatalogCountryResult {
  /**
   * ISO-2 country code to pass to the catalog query.
   * `undefined` while loading, or when the detected device country is not in
   * the backend-supported list (in which case the catalog should show all products).
   */
  countryCode: string | undefined;
  /** True while the supported-country list is being fetched. */
  loading: boolean;
}

/**
 * Resolves the device locale country code for unauthenticated catalog queries.
 * Returns the code only when the backend confirms the detected country is
 * supported; otherwise returns `undefined` so the catalog shows all products.
 *
 * Should only be called for guests (`inventoryRequestsWithAuth === false`).
 */
export function useGuestCatalogCountry(): UseGuestCatalogCountryResult {
  const deviceCountry = useMemo(() => getDeviceDefaultCountryCode(), []);
  const { allowedIsos, loading } = useSupportedCountries();

  const countryCode = useMemo<string | undefined>(() => {
    if (loading) return undefined;
    const upper = deviceCountry.toUpperCase();
    return allowedIsos.some((iso) => iso.toUpperCase() === upper) ? upper : undefined;
  }, [loading, deviceCountry, allowedIsos]);

  return { countryCode, loading };
}
