import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';

export interface ApplicationConfiguration {
  id: string;
  config_key: string;
  config_name: string;
  description?: string;
  data_type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'json'
    | 'array'
    | 'date'
    | 'currency';
  string_value?: string;
  number_value?: number;
  boolean_value?: boolean;
  json_value?: any;
  array_value?: string[];
  date_value?: string;
  country_code?: string;
  status: 'active' | 'inactive' | 'deprecated';
  version: number;
  tags?: string[];
  validation_rules?: any;
  min_value?: number;
  max_value?: number;
  allowed_values?: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

@Injectable()
export class ConfigurationsService {
  private readonly logger = new Logger(ConfigurationsService.name);

  constructor(private readonly hasuraService: HasuraSystemService) {}

  async getAllConfigurations(): Promise<ApplicationConfiguration[]> {
    try {
      const query = `
        query GetAllConfigurations {
          application_configurations(order_by: { config_key: asc, country_code: asc }) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query);
      return response.application_configurations || [];
    } catch (error) {
      this.logger.error('Failed to fetch configurations', error);
      throw error;
    }
  }

  async getConfigurationById(
    id: string
  ): Promise<ApplicationConfiguration | null> {
    try {
      const query = `
        query GetConfigurationById($id: uuid!) {
          application_configurations_by_pk(id: $id) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, { id });
      return response.application_configurations_by_pk;
    } catch (error) {
      this.logger.error(`Failed to fetch configuration with id: ${id}`, error);
      throw error;
    }
  }

  async getConfigurationByKey(
    configKey: string,
    countryCode?: string
  ): Promise<ApplicationConfiguration | null> {
    try {
      const query = `
        query GetConfigurationByKey($config_key: String!, $country_code: String) {
          application_configurations(
            where: { 
              config_key: { _eq: $config_key },
              country_code: { _eq: $country_code },
              status: { _eq: "active" }
            }
          ) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        config_key: configKey,
        country_code: countryCode,
      });
      return response.application_configurations[0] || null;
    } catch (error) {
      this.logger.error(
        `Failed to fetch configuration with key: ${configKey} and country: ${countryCode}`,
        error
      );
      throw error;
    }
  }

  async updateConfiguration(
    id: string,
    updateDto: UpdateConfigurationDto,
    updatedBy?: string
  ): Promise<ApplicationConfiguration> {
    try {
      // Validate that the config key is not being changed
      const existingConfig = await this.getConfigurationById(id);
      if (!existingConfig) {
        throw new Error('Configuration not found');
      }

      // Prepare update object with only provided fields
      const updateObject: any = {
        ...updateDto,
        updated_by: updatedBy,
      };

      // Remove undefined values
      Object.keys(updateObject).forEach(
        (key) => updateObject[key] === undefined && delete updateObject[key]
      );

      const mutation = `
        mutation UpdateConfiguration($id: uuid!, $updates: application_configurations_set_input!) {
          update_application_configurations_by_pk(
            pk_columns: { id: $id },
            _set: $updates
          ) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(mutation, {
        id,
        updates: updateObject,
      });

      return response.update_application_configurations_by_pk;
    } catch (error) {
      this.logger.error(`Failed to update configuration with id: ${id}`, error);
      throw error;
    }
  }

  async deleteConfiguration(id: string): Promise<boolean> {
    try {
      const mutation = `
        mutation DeleteConfiguration($id: uuid!) {
          delete_application_configurations_by_pk(id: $id) {
            id
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(mutation, { id });
      return !!response.delete_application_configurations_by_pk;
    } catch (error) {
      this.logger.error(`Failed to delete configuration with id: ${id}`, error);
      throw error;
    }
  }

  async getConfigurationsByCountry(
    countryCode: string
  ): Promise<ApplicationConfiguration[]> {
    try {
      const query = `
        query GetConfigurationsByCountry($country_code: String!) {
          application_configurations(
            where: { country_code: { _eq: $country_code } },
            order_by: { config_key: asc }
          ) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        country_code: countryCode,
      });
      return response.application_configurations || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch configurations for country: ${countryCode}`,
        error
      );
      throw error;
    }
  }

  async getConfigurationsByTags(
    tags: string[]
  ): Promise<ApplicationConfiguration[]> {
    try {
      const query = `
        query GetConfigurationsByTags($tags: [String!]!) {
          application_configurations(
            where: { tags: { _has_any: $tags } },
            order_by: { config_key: asc }
          ) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, { tags });
      return response.application_configurations || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch configurations with tags: ${tags.join(', ')}`,
        error
      );
      throw error;
    }
  }

  async getFastDeliveryConfigurations(
    countryCode: string
  ): Promise<ApplicationConfiguration[]> {
    try {
      const query = `
        query GetFastDeliveryConfigurations($country_code: String!) {
          application_configurations(
            where: { 
              country_code: { _eq: $country_code },
              status: { _eq: "active" },
              tags: { _contains: ["fast-delivery"] }
            }
          ) {
            id
            config_key
            config_name
            description
            data_type
            string_value
            number_value
            boolean_value
            json_value
            array_value
            date_value
            country_code
            status
            version
            tags
            validation_rules
            min_value
            max_value
            allowed_values
            created_at
            updated_at
            created_by
            updated_by
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        country_code: countryCode,
      });
      return response.application_configurations || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch fast delivery configurations for country: ${countryCode}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get fast delivery configuration from supported locations
   * Matches either state_code or state_name with the provided stateCode
   * @param countryCode - Country code (e.g., 'GA')
   * @param stateCode - State code or state name (e.g., 'Estuaire' or 'ES')
   * @returns Fast delivery configuration or null if not found
   */
  async getFastDeliveryFromSupportedLocations(
    countryCode: string,
    stateCode?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    try {
      let query: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let variables: any;

      if (stateCode) {
        query = `
          query GetFastDeliveryFromLocation($country_code: bpchar!, $state_code: String!) {
            supported_country_states(
              where: { 
                country_code: { _eq: $country_code },
                _or: [
                  { state_code: { _eq: $state_code } },
                  { state_name: { _eq: $state_code } }
                ]
              }
            ) {
              id
              fast_delivery
              service_status
              delivery_enabled
            }
          }
        `;
        variables = { country_code: countryCode, state_code: stateCode };
      } else {
        query = `
          query GetFastDeliveryFromCountry($country_code: bpchar!) {
            supported_country_states(
              where: { country_code: { _eq: $country_code } }
              limit: 1
            ) {
              id
              fast_delivery
              service_status
              delivery_enabled
            }
          }
        `;
        variables = { country_code: countryCode };
      }

      const response = await this.hasuraService.executeQuery(query, variables);
      const locations = response.supported_country_states || [];

      if (locations.length === 0) {
        return null;
      }

      const location = locations[0];
      return (
        location.fast_delivery || {
          enabled: false,
          fee: 0,
          minHours: 0,
          maxHours: 0,
          operatingHours: {},
        }
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch fast delivery from supported locations for country: ${countryCode}, state: ${
          stateCode || 'any'
        }`,
        error
      );
      throw error;
    }
  }
}
