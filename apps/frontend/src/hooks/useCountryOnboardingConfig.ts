import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CountryOnboardingDeliveryTimeSlot {
  id?: string;
  country_code: string;
  state?: string | null;
  slot_name: string;
  slot_type: string;
  start_time: string;
  end_time: string;
  is_active?: boolean | null;
  max_orders_per_slot?: number | null;
  display_order?: number | null;
}

export interface CountryOnboardingSupportedState {
  id?: string;
  country_code: string;
  state_name: string;
  service_status: string;
  delivery_enabled: boolean;
}

export interface CountryOnboardingCountryConfig {
  country_code: string;
  configs: {
    config_key: string;
    config_value: string;
    data_type: 'string' | 'number' | 'boolean' | 'json';
    description?: string | null;
  }[];
}

export interface CountryOnboardingConfig {
  countryCode: string;
  countryDeliveryConfig: CountryOnboardingCountryConfig | null;
  deliveryTimeSlots: CountryOnboardingDeliveryTimeSlot[];
  supportedStates: CountryOnboardingSupportedState[];
}

interface CountryOnboardingConfigApiResponse {
  success: boolean;
  data?: CountryOnboardingConfig;
  error?: string;
}

interface ApplyCountryOnboardingApiResponse {
  success: boolean;
  error?: string;
}

export interface UseCountryOnboardingConfigResult {
  data: CountryOnboardingConfig | null;
  loading: boolean;
  error: string | null;
  fetchConfig: (countryCode: string) => Promise<void>;
  applyConfig: (config: CountryOnboardingConfig) => Promise<boolean>;
  applying: boolean;
}

export const useCountryOnboardingConfig =
  (): UseCountryOnboardingConfigResult => {
    const apiClient = useApiClient();
    const [data, setData] = useState<CountryOnboardingConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(
      async (countryCode: string) => {
        if (!countryCode) {
          setError('Country code is required');
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const response =
            await apiClient.get<CountryOnboardingConfigApiResponse>(
              `/admin/country-onboarding/${countryCode}`
            );

          if (!response.data.success || !response.data.data) {
            const message =
              response.data.error ||
              'Failed to load country onboarding configuration';
            setError(message);
            return;
          }

          setData(response.data.data);
        } catch (err: any) {
          const message =
            err.response?.data?.error ||
            err.message ||
            'Failed to load country onboarding configuration';
          setError(message);
        } finally {
          setLoading(false);
        }
      },
      [apiClient]
    );

    const applyConfig = useCallback(
      async (config: CountryOnboardingConfig): Promise<boolean> => {
        setApplying(true);
        setError(null);

        try {
          const response =
            await apiClient.post<ApplyCountryOnboardingApiResponse>(
              '/admin/country-onboarding/apply',
              config
            );

          if (!response.data.success) {
            const message =
              response.data.error ||
              'Failed to apply country onboarding configuration';
            setError(message);
            return false;
          }

          setData(config);
          return true;
        } catch (err: any) {
          const message =
            err.response?.data?.error ||
            err.message ||
            'Failed to apply country onboarding configuration';
          setError(message);
          return false;
        } finally {
          setApplying(false);
        }
      },
      [apiClient]
    );

    return {
      data,
      loading,
      error,
      fetchConfig,
      applyConfig,
      applying,
    };
  };

