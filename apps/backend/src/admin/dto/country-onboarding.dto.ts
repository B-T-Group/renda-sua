export interface CountryOnboardingCountryConfigEntry {
  config_key: string;
  config_value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string | null;
}

export interface CountryOnboardingCountryConfig {
  country_code: string;
  configs: CountryOnboardingCountryConfigEntry[];
}

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

export interface CountryOnboardingConfigDto {
  countryCode: string;
  countryDeliveryConfig: CountryOnboardingCountryConfig | null;
  deliveryTimeSlots: CountryOnboardingDeliveryTimeSlot[];
  supportedStates: CountryOnboardingSupportedState[];
}

