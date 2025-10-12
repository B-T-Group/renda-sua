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
  isEnabledForLocation: (countryCode: string, stateCode: string) => boolean;
  refreshConfig: () => Promise<void>;
}

/**
 * Hook to fetch and manage fast delivery configuration for a specific location
 * @param countryCode - The country code (e.g., 'GA' for Gabon)
 * @param stateCode - The state/province code (e.g., 'Estuaire')
 * @returns Fast delivery configuration data and utilities
 */
export const useFastDeliveryConfig = (
  countryCode: string,
  stateCode: string
): UseFastDeliveryConfigResult => {
  const apiClient = useApiClient();
  const [config, setConfig] = useState<FastDeliveryConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshConfig = useCallback(async () => {
    if (!countryCode || !stateCode) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/orders/fast-delivery-config?countryCode=${countryCode}&stateCode=${stateCode}`
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
  }, [countryCode, stateCode, apiClient]);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const isEnabledForLocation = useCallback(
    (country: string, state: string) => {
      return config?.enabled ?? false;
    },
    [config]
  );

  return {
    config,
    loading,
    error,
    isEnabledForLocation,
    refreshConfig,
  };
};
