import { useEffect, useMemo, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import {
  getSupportedCountries,
  type SupportedCountry,
} from '../services/supportedCountriesApi';

interface UseSupportedCountriesResult {
  /** ISO2 codes of supported countries (uppercased). */
  allowedIsos: CountryCode[];
  /** Full supported-country records (code, name, payment methods, etc.). */
  countries: SupportedCountry[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads the countries the platform supports. Returns empty lists while loading
 * or on error, so callers can treat "no restriction" safely.
 */
export function useSupportedCountries(): UseSupportedCountriesResult {
  const [countries, setCountries] = useState<SupportedCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSupportedCountries()
      .then((list) => {
        if (!active) return;
        setCountries(list);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load countries');
        setCountries([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const allowedIsos = useMemo(
    () =>
      countries
        .map((c) => c.code?.toUpperCase())
        .filter((code): code is string => !!code) as CountryCode[],
    [countries]
  );

  return { allowedIsos, countries, loading, error };
}

/** True when the supported-country record routes payments through Stripe. */
export function countrySupportsStripe(
  countries: SupportedCountry[],
  code: string | undefined
): boolean {
  if (!code) return false;
  const match = countries.find((c) => c.code?.toUpperCase() === code.toUpperCase());
  return !!match?.supportedPaymentMethods?.includes('stripe');
}

/** Signup wizard countries only (`signupEnabled !== false`; missing flag = enabled). */
export function filterSignupEnabledCountries(
  countries: SupportedCountry[]
): SupportedCountry[] {
  return countries.filter((c) => c.signupEnabled !== false);
}
