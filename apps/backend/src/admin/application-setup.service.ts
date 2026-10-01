import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ApplicationSetupQueryRawResponse,
  ApplicationSetupResponse,
} from './dto/application-setup.dto';

const PER_KM_MAX_XAF: Record<string, number> = { CM: 1500, GA: 1500 };

const PRICING_KEYS = [
  'normal_delivery_base_fee',
  'per_km_delivery_fee',
  'max_delivery_fee',
  'delivery_availability_radius_km',
  'free_delivery_commission_threshold',
] as const;

export type DeliveryPricingKey = (typeof PRICING_KEYS)[number];
export type DeliveryPricingInput = Record<DeliveryPricingKey, number>;

@Injectable()
export class ApplicationSetupService {
  private readonly logger = new Logger(ApplicationSetupService.name);

  constructor(private readonly hasuraService: HasuraSystemService) {}

  private buildQuery(): string {
    return `
      query GetApplicationSetup(
        $country_code_bp: bpchar!
        $country_code_str: String!
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
            config_key
            description
          }
        }
        delivery_configs {
          config_key
          description
        }
        application_configurations(
          where: {
            country_code: { _eq: $country_code_str }
            config_key: { _eq: "cancellation_fee_percent" }
          }
        ) {
          id
          config_key
          config_name
          number_value
          country_code
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
      }
    `;
  }

  async getApplicationSetup(
    countryCode: string
  ): Promise<ApplicationSetupResponse> {
    try {
      const query = this.buildQuery();
      const variables = {
        country_code_bp: countryCode,
        country_code_str: countryCode,
      };
      const result =
        await this.hasuraService.executeQuery<ApplicationSetupQueryRawResponse>(
          query,
          variables
        );

      return {
        country_delivery_configs: result.country_delivery_configs || [],
        delivery_configs: result.delivery_configs || [],
        application_configurations: result.application_configurations || [],
        delivery_time_slots: result.delivery_time_slots || [],
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch application setup for country ${countryCode}`,
        error
      );
      throw error;
    }
  }

  async upsertDeliveryPricing(
    countryCode: string,
    pricing: DeliveryPricingInput
  ): Promise<void> {
    const code = countryCode.trim().toUpperCase();
    this.assertPricing(code, pricing);
    await this.hasuraService.executeMutation(this.upsertMutation(), {
      objects: PRICING_KEYS.map((key) => ({
        country_code: code,
        config_key: key,
        config_value: String(pricing[key]),
        data_type: 'number',
      })),
    });
  }

  private assertPricing(code: string, pricing: DeliveryPricingInput): void {
    if (code.length !== 2) {
      throw new Error('countryCode must be a 2-letter ISO code');
    }
    for (const key of PRICING_KEYS) {
      const value = pricing[key];
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${key} must be a non-negative number`);
      }
    }
    const maxPerKm = PER_KM_MAX_XAF[code];
    if (maxPerKm && pricing.per_km_delivery_fee > maxPerKm) {
      throw new Error(`per_km_delivery_fee cannot exceed ${maxPerKm} XAF`);
    }
  }

  private upsertMutation(): string {
    return `
      mutation UpsertDeliveryPricing(
        $objects: [country_delivery_configs_insert_input!]!
      ) {
        insert_country_delivery_configs(
          objects: $objects
          on_conflict: {
            constraint: unique_country_config
            update_columns: [config_value, data_type]
          }
        ) { affected_rows }
      }
    `;
  }
}
