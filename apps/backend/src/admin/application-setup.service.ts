import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  ApplicationSetupQueryRawResponse,
  ApplicationSetupResponse,
} from './dto/application-setup.dto';

@Injectable()
export class ApplicationSetupService {
  private readonly logger = new Logger(ApplicationSetupService.name);

  constructor(private readonly hasuraService: HasuraSystemService) {}

  private buildQuery(): string {
    return `
      query GetApplicationSetup($country_code: bpchar!) {
        country_delivery_configs(where: { country_code: { _eq: $country_code } }) {
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
            country_code: { _eq: $country_code }
            config_key: { _eq: "cancellation_fee" }
          }
        ) {
          id
          config_key
          config_name
          number_value
          country_code
        }
        delivery_time_slots(
          where: { country_code: { _eq: $country_code } }
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
      const variables = { country_code: countryCode };
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
}


