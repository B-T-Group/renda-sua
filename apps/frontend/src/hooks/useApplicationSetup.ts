import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CountryDeliveryConfigRow {
  id: string;
  country_code: string;
  config_key: string;
  config_value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  delivery_config?: {
    config_key: string;
    description?: string | null;
  } | null;
}

export interface DeliveryConfigRow {
  config_key: string;
  description?: string | null;
}

export interface ApplicationConfigurationRow {
  id: string;
  config_key: string;
  config_name: string;
  number_value?: number | null;
  country_code?: string | null;
}

export interface DeliveryTimeSlotRow {
  id: string;
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

export interface ApplicationSetupData {
  country_delivery_configs: CountryDeliveryConfigRow[];
  delivery_configs: DeliveryConfigRow[];
  application_configurations: ApplicationConfigurationRow[];
  delivery_time_slots: DeliveryTimeSlotRow[];
}

interface ApplicationSetupApiResponse {
  success: boolean;
  data?: ApplicationSetupData;
  error?: string;
}

export interface DeliveryPricingInput {
  normal_delivery_base_fee: number;
  per_km_delivery_fee: number;
  max_delivery_fee: number;
  delivery_availability_radius_km: number;
  free_delivery_commission_threshold: number;
}

export interface UseApplicationSetupResult {
  setup: ApplicationSetupData | null;
  loading: boolean;
  error: string | null;
  fetchSetup: (countryCode: string) => Promise<void>;
  saveDeliveryPricing: (
    countryCode: string,
    pricing: DeliveryPricingInput
  ) => Promise<void>;
}

export const useApplicationSetup = (): UseApplicationSetupResult => {
  const apiClient = useApiClient();
  const [setup, setSetup] = useState<ApplicationSetupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSetup = useCallback(
    async (countryCode: string) => {
      if (!countryCode) {
        setError('Country code is required');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<ApplicationSetupApiResponse>(
          `/admin/application-setup`,
          {
            params: { countryCode },
          }
        );

        if (!response.data.success || !response.data.data) {
          const message =
            response.data.error || 'Failed to load application setup';
          setError(message);
          return;
        }

        setSetup(response.data.data);
      } catch (err: any) {
        const message =
          err.response?.data?.error ||
          err.message ||
          'Failed to load application setup';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const saveDeliveryPricing = useCallback(
    async (countryCode: string, pricing: DeliveryPricingInput) => {
      const response = await apiClient.post<{ success: boolean; error?: string }>(
        '/admin/application-setup/delivery-pricing',
        { countryCode, ...pricing }
      );
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to save delivery pricing');
      }
      await fetchSetup(countryCode);
    },
    [apiClient, fetchSetup]
  );

  return {
    setup,
    loading,
    error,
    fetchSetup,
    saveDeliveryPricing,
  };
};
