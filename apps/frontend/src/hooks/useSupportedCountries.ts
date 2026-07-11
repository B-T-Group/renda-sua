import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface SupportedCountry {
  code: string;
  name: string;
  currencyCode: string;
  serviceStatus: string;
  deliveryEnabled: boolean;
  supportedPaymentMethods: string[];
}

interface SupportedCountriesResponse {
  success: boolean;
  countries: SupportedCountry[];
}

// Module-level cache so multiple consumers don't refetch.
let cachedCountries: SupportedCountry[] | null = null;
let cachedIsos: string[] | null = null;

export const useSupportedCountries = () => {
  const apiClient = useApiClient();
  const [countries, setCountries] = useState<SupportedCountry[]>(
    cachedCountries ?? []
  );
  const [supportedIsos, setSupportedIsos] = useState<string[]>(
    cachedIsos ?? []
  );
  const [loading, setLoading] = useState(!cachedCountries);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedCountries) {
      setCountries(cachedCountries);
      setSupportedIsos(cachedIsos ?? []);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    apiClient
      .get<SupportedCountriesResponse>('/locations/supported-countries')
      .then((res) => {
        if (!active) return;
        const list = res.data.countries || [];
        const isos = list
          .map((c) => c.code?.toUpperCase())
          .filter((code): code is string => !!code);
        cachedCountries = list;
        cachedIsos = isos;
        setCountries(list);
        setSupportedIsos(isos);
        setError(null);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to fetch supported countries'
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiClient]);

  return { countries, supportedIsos, loading, error };
};
