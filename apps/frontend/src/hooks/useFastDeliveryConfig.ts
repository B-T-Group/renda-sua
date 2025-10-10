import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface FastDeliveryConfig {
  enabled: boolean;
  fee: number;
  minHours: number;
  maxHours: number;
  operatingHours: {
    [key: string]: {
      start: string;
      end: string;
      enabled: boolean;
    };
  };
}

export interface UseFastDeliveryConfigResult {
  config: FastDeliveryConfig | null;
  loading: boolean;
  error: string | null;
  isEnabledForCountry: (countryCode: string) => boolean;
  refreshConfig: () => Promise<void>;
}

export const useFastDeliveryConfig = (
  countryCode?: string
): UseFastDeliveryConfigResult => {
  const apiClient = useApiClient();
  const [config, setConfig] = useState<FastDeliveryConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConfig = useCallback(async () => {
    if (!countryCode) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/orders/fast-delivery-config?countryCode=${countryCode}`
      );

      if (response.data.success) {
        setConfig(response.data.config);
      } else {
        throw new Error(
          response.data.error || 'Failed to fetch fast delivery config'
        );
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to fetch fast delivery configuration';
      setError(errorMessage);
      console.error('Failed to fetch fast delivery config:', err);
    } finally {
      setLoading(false);
    }
  }, [countryCode, apiClient]);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const isEnabledForCountry = useCallback(
    (country: string) => {
      return config?.enabled ?? false;
    },
    [config]
  );

  return {
    config,
    loading,
    error,
    isEnabledForCountry,
    refreshConfig,
  };
};
