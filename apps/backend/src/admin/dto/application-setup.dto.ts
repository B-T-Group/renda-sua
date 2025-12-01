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

export interface ApplicationSetupResponse {
  country_delivery_configs: CountryDeliveryConfigRow[];
  delivery_configs: DeliveryConfigRow[];
  application_configurations: ApplicationConfigurationRow[];
  delivery_time_slots: DeliveryTimeSlotRow[];
}

interface ApplicationSetupQueryResult {
  country_delivery_configs: CountryDeliveryConfigRow[];
  delivery_configs: DeliveryConfigRow[];
  application_configurations: ApplicationConfigurationRow[];
  delivery_time_slots: DeliveryTimeSlotRow[];
}

export type ApplicationSetupQueryRawResponse = ApplicationSetupQueryResult;
