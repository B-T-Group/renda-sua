import { useEffect, useMemo, useState } from 'react';
import { businessItemsApiParams } from '../utils/businessItemsApiParams';
import { useApiClient } from './useApiClient';
import {
  type SupportedCountry,
  useSupportedCountries,
} from './useSupportedCountries';

interface BusinessLocationsCurrencyResponse {
  success: boolean;
  data?: {
    primary_address_country?: string | null;
  };
}

/**
 * Locks item/rental currency to the business primary-address country
 * (e.g. CA → CAD, GA/CM → XAF).
 */
export function useBusinessLockedCurrency(businessId?: string | null) {
  const apiClient = useApiClient();
  const { countries, loading: countriesLoading } = useSupportedCountries();
  const [primaryCountry, setPrimaryCountry] = useState<string | null>(null);
  const [countryLoading, setCountryLoading] = useState(!!businessId);

  useEffect(() => {
    if (!businessId) {
      setPrimaryCountry(null);
      setCountryLoading(false);
      return;
    }
    let active = true;
    setCountryLoading(true);
    apiClient
      .get<BusinessLocationsCurrencyResponse>(
        '/business-items/locations',
        businessItemsApiParams(businessId)
      )
      .then((res) => {
        if (!active) return;
        setPrimaryCountry(res.data?.data?.primary_address_country ?? null);
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
  }, [apiClient, businessId]);

  const lockedCurrency = useMemo(() => {
    return resolveCurrencyForCountry(primaryCountry, countries);
  }, [countries, primaryCountry]);

  return {
    lockedCurrency,
    primaryCountry,
    loading: countriesLoading || countryLoading,
  };
}

export function resolveCurrencyForCountry(
  country: string | null | undefined,
  countries: SupportedCountry[]
): string {
  if (!country?.trim()) return 'XAF';
  const code = country.trim().toUpperCase().slice(0, 2);
  const match = countries.find((c) => c.code?.toUpperCase() === code);
  if (match?.currencyCode?.trim()) {
    return match.currencyCode.trim().toUpperCase();
  }
  if (code === 'CA') return 'CAD';
  if (code === 'US') return 'USD';
  if (['GA', 'CM', 'TD', 'CF', 'CG', 'GQ'].includes(code)) return 'XAF';
  return 'XAF';
}
