import { useEffect, useMemo, useState } from 'react';
import { businessApi } from '../../services/businessApi';
import { useSupportedCountries } from '../useSupportedCountries';

interface UseSupportedCurrenciesResult {
  /** Distinct currency codes derived from the platform's supported countries. */
  currencies: string[];
  /** Currency of the business' primary address country, when resolvable. */
  defaultCurrency: string | null;
  loading: boolean;
}

/**
 * Loads the currencies the platform supports (from `supported_country_states`)
 * and resolves a sensible default from the business' primary address country.
 */
export function useSupportedCurrencies(): UseSupportedCurrenciesResult {
  const { countries, loading: countriesLoading } = useSupportedCountries();
  const [primaryCountry, setPrimaryCountry] = useState<string | null>(null);
  const [countryLoading, setCountryLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setCountryLoading(true);
    businessApi.locations
      .list()
      .then((res) => {
        if (!active) return;
        setPrimaryCountry(res.data?.primary_address_country ?? null);
      })
      .catch(() => {
        if (active) setPrimaryCountry(null);
      })
      .finally(() => {
        if (active) setCountryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    countries.forEach((c) => {
      if (c.currencyCode) set.add(c.currencyCode.toUpperCase());
    });
    return Array.from(set).sort();
  }, [countries]);

  const defaultCurrency = useMemo(() => {
    if (!primaryCountry) return null;
    const match = countries.find(
      (c) => c.code?.toUpperCase() === primaryCountry.toUpperCase()
    );
    return match?.currencyCode?.toUpperCase() ?? null;
  }, [countries, primaryCountry]);

  return {
    currencies,
    defaultCurrency,
    loading: countriesLoading || countryLoading,
  };
}
