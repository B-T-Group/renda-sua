import { useState, useEffect } from 'react';
import { useApiClient } from './useApiClient';

export interface PaymentProvider {
  name: string;
  supportedMethods: string[];
  supportedCurrencies: string[];
  isAvailable: boolean;
}

interface ProvidersResponse {
  success: boolean;
  data: PaymentProvider[];
}

/**
 * Hook to fetch available mobile payment providers for a country
 * @param country ISO 3166-1 alpha-2 country code (e.g. 'TG')
 */
export const useMobilePaymentProviders = (country?: string) => {
  const apiClient = useApiClient();
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!country) {
      setProviders([]);
      return;
    }

    const fetchProviders = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ country });
        const response = await apiClient.get<ProvidersResponse>(
          `/mobile-payments/providers?${params.toString()}`
        );

        if (response.success && response.data) {
          setProviders(response.data);
        } else {
          setProviders([]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch payment providers');
        setProviders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [country, apiClient]);

  const isFedaPayAvailable = providers.some(
    (p) => p.name.toLowerCase() === 'fedapay' && p.isAvailable
  );

  return {
    providers,
    loading,
    error,
    isFedaPayAvailable,
  };
};
