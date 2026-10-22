import { useMemo } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { useSupportedCountries } from './useSupportedCountries';
import { resolveMobileMoneyCountries } from '../utils/placeOrderPhoneValidation';

/**
 * Mobile Money countries for phone pickers and validation, driven by the
 * backend's per-country list (`/locations/supported-countries`, cached).
 * Returns the static CM/GA/TG fallback while loading or on error.
 */
export function useMobileMoneyCountries(): { isos: CountryCode[]; loading: boolean } {
  const { countries, loading } = useSupportedCountries();
  const isos = useMemo(() => resolveMobileMoneyCountries(countries), [countries]);
  return { isos, loading };
}
