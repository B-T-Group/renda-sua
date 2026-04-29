import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  CountryOnboardingConfigDto,
  CountryOnboardingCountryConfig,
  CountryOnboardingCountryConfigEntry,
  CountryOnboardingDeliveryTimeSlot,
  CountryOnboardingSupportedState,
} from './dto/country-onboarding.dto';

interface CountryDeliveryConfigRow {
  id: string;
  country_code: string;
  config_key: string;
  config_value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  delivery_config?: {
    description?: string | null;
  } | null;
}

interface DeliveryTimeSlotRow {
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

interface SupportedCountryStateRow {
  id: string;
  country_code: string;
  state_name: string;
  service_status: string;
  delivery_enabled: boolean;
}

interface CountryOnboardingQueryResult {
  country_delivery_configs: CountryDeliveryConfigRow[];
  delivery_time_slots: DeliveryTimeSlotRow[];
  supported_country_states: SupportedCountryStateRow[];
}

const PER_KM_DELIVERY_FEE_CONFIG_KEY = 'per_km_delivery_fee';
const PER_KM_DELIVERY_FEE_MAX_XAF_BY_COUNTRY: Record<string, number> = {
  CM: 1500,
  GA: 1500,
};

@Injectable()
export class CountryOnboardingService {
  private readonly logger = new Logger(CountryOnboardingService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async getCountryOnboardingConfig(
    countryCode: string
  ): Promise<CountryOnboardingConfigDto> {
    const query = `
      query GetCountryOnboarding(
        $country_code_bp: bpchar!
      ) {
        country_delivery_configs(
          where: { country_code: { _eq: $country_code_bp } }
        ) {
          id
          country_code
          config_key
          config_value
          data_type
          delivery_config {
            description
          }
        }
        delivery_time_slots(
          where: { country_code: { _eq: $country_code_bp } }
          order_by: { display_order: asc }
        ) {
          id
          country_code
          state
          slot_name
          slot_type
          start_time
          end_time
          is_active
          max_orders_per_slot
          display_order
        }
        supported_country_states(
          where: { country_code: { _eq: $country_code_bp } }
          order_by: { state_name: asc }
        ) {
          id
          country_code
          state_name
          service_status
          delivery_enabled
        }
      }
    `;

    try {
      const variables = {
        country_code_bp: countryCode,
      };

      const result =
        await this.hasura.executeQuery<CountryOnboardingQueryResult>(
          query,
          variables
        );

      const countryDeliveryConfig =
        this.buildCountryDeliveryConfig(result.country_delivery_configs);

      return {
        countryCode,
        countryDeliveryConfig,
        deliveryTimeSlots: (result.delivery_time_slots || []).map(
          this.mapTimeSlotRowToDto
        ),
        supportedStates: (result.supported_country_states || []).map(
          this.mapSupportedStateRowToDto
        ),
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch country onboarding config for ${countryCode}`,
        error
      );
      throw error;
    }
  }

  async applyCountryOnboardingConfig(
    input: CountryOnboardingConfigDto
  ): Promise<void> {
    this.validateConfig(input);

    const mutation = `
      mutation ApplyCountryOnboarding(
        $country_code_bp: bpchar!
        $country_configs: [country_delivery_configs_insert_input!]!
        $time_slots: [delivery_time_slots_insert_input!]!
        $supported_states: [supported_country_states_insert_input!]!
      ) {
        delete_country_delivery_configs(
          where: { country_code: { _eq: $country_code_bp } }
        ) {
          affected_rows
        }
        delete_delivery_time_slots(
          where: { country_code: { _eq: $country_code_bp } }
        ) {
          affected_rows
        }
        delete_supported_country_states(
          where: { country_code: { _eq: $country_code_bp } }
        ) {
          affected_rows
        }
        insert_country_delivery_configs(
          objects: $country_configs
        ) {
          affected_rows
        }
        insert_delivery_time_slots(
          objects: $time_slots
        ) {
          affected_rows
        }
        insert_supported_country_states(
          objects: $supported_states
        ) {
          affected_rows
        }
      }
    `;

    const variables = {
      country_code_bp: input.countryCode,
      country_configs: this.mapCountryConfigsToInsert(input.countryDeliveryConfig),
      time_slots: this.mapTimeSlotsToInsert(input),
      supported_states: this.mapSupportedStatesToInsert(input),
    };

    try {
      await this.hasura.executeMutation(mutation, variables);
    } catch (error: any) {
      this.logger.error(
        `Failed to apply country onboarding config for ${input.countryCode}`,
        error
      );
      throw error;
    }
  }

  private buildCountryDeliveryConfig(
    rows: CountryDeliveryConfigRow[] | undefined
  ): CountryOnboardingCountryConfig | null {
    if (!rows || rows.length === 0) {
      return null;
    }

    const entries: CountryOnboardingCountryConfigEntry[] = rows.map((row) => ({
      config_key: row.config_key,
      config_value: row.config_value,
      data_type: row.data_type,
      description: row.delivery_config?.description ?? null,
    }));

    return {
      country_code: rows[0].country_code,
      configs: entries,
    };
  }

  private mapTimeSlotRowToDto(
    row: DeliveryTimeSlotRow
  ): CountryOnboardingDeliveryTimeSlot {
    return {
      id: row.id,
      country_code: row.country_code,
      state: row.state,
      slot_name: row.slot_name,
      slot_type: row.slot_type,
      start_time: row.start_time,
      end_time: row.end_time,
      is_active: row.is_active,
      max_orders_per_slot: row.max_orders_per_slot,
      display_order: row.display_order,
    };
  }

  private mapSupportedStateRowToDto(
    row: SupportedCountryStateRow
  ): CountryOnboardingSupportedState {
    return {
      id: row.id,
      country_code: row.country_code,
      state_name: row.state_name,
      service_status: row.service_status,
      delivery_enabled: row.delivery_enabled,
    };
  }

  private validateConfig(config: CountryOnboardingConfigDto): void {
    if (!config.countryCode || config.countryCode.length !== 2) {
      throw new Error('countryCode is required and must be a 2-letter ISO code');
    }

    this.validatePerKmDeliveryFeeLimit(
      config.countryCode,
      config.countryDeliveryConfig
    );

    config.deliveryTimeSlots.forEach((slot) => {
      if (!slot.slot_name || !slot.slot_type) {
        throw new Error('Each delivery time slot must have a name and type');
      }
      if (!slot.start_time || !slot.end_time) {
        throw new Error('Each delivery time slot must have start and end times');
      }
    });
  }

  private validatePerKmDeliveryFeeLimit(
    countryCode: string,
    countryDeliveryConfig: CountryOnboardingCountryConfig | null
  ): void {
    const maxValue = PER_KM_DELIVERY_FEE_MAX_XAF_BY_COUNTRY[countryCode];
    if (!maxValue || !countryDeliveryConfig) return;
    const feeConfig = countryDeliveryConfig.configs.find(
      (entry) => entry.config_key === PER_KM_DELIVERY_FEE_CONFIG_KEY
    );
    if (!feeConfig) return;
    const parsedValue = Number(feeConfig.config_value);
    if (Number.isNaN(parsedValue)) {
      throw new Error(
        `${PER_KM_DELIVERY_FEE_CONFIG_KEY} must be a valid number for ${countryCode}`
      );
    }
    if (parsedValue > maxValue) {
      throw new Error(
        `${PER_KM_DELIVERY_FEE_CONFIG_KEY} cannot exceed ${maxValue} XAF for ${countryCode}`
      );
    }
  }

  private mapCountryConfigsToInsert(
    config: CountryOnboardingCountryConfig | null
  ): Array<Record<string, unknown>> {
    if (!config) {
      return [];
    }

    return config.configs.map((entry) => ({
      country_code: config.country_code,
      config_key: entry.config_key,
      config_value: entry.config_value,
      data_type: entry.data_type,
    }));
  }

  private mapTimeSlotsToInsert(
    config: CountryOnboardingConfigDto
  ): Array<Record<string, unknown>> {
    return config.deliveryTimeSlots.map((slot) => ({
      country_code: config.countryCode,
      state: slot.state ?? null,
      slot_name: slot.slot_name,
      slot_type: slot.slot_type,
      start_time: slot.start_time,
      end_time: slot.end_time,
      is_active: slot.is_active ?? true,
      max_orders_per_slot: slot.max_orders_per_slot ?? null,
      display_order: slot.display_order ?? null,
    }));
  }

  private mapSupportedStatesToInsert(
    config: CountryOnboardingConfigDto
  ): Array<Record<string, unknown>> {
    return config.supportedStates.map((state) => ({
      country_code: config.countryCode,
      state_name: state.state_name,
      service_status: state.service_status,
      delivery_enabled: state.delivery_enabled,
    }));
  }
}

