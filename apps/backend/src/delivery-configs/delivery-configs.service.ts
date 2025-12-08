import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface FastDeliveryConfig {
  enabled: boolean;
  baseFee: number;
  sla: number;
  serviceHours: {
    [day: string]: {
      start: string;
      end: string;
      enabled: boolean;
    };
  };
}

@Injectable()
export class DeliveryConfigService {
  private readonly logger = new Logger(DeliveryConfigService.name);

  constructor(private readonly hasuraService: HasuraSystemService) {}

  /**
   * Get a single delivery configuration value for a country
   * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'GA')
   * @param configKey - Configuration key from delivery_configs table
   * @returns Configuration value parsed according to its data type, or null if not found
   */
  async getDeliveryConfig(
    countryCode: string,
    configKey: string
  ): Promise<string | number | boolean | object | null> {
    try {
      const query = `
        query GetDeliveryConfig($country_code: bpchar!, $config_key: String!) {
          country_delivery_configs(
            where: {
              country_code: { _eq: $country_code },
              config_key: { _eq: $config_key }
            }
            limit: 1
          ) {
            config_value
            data_type
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        country_code: countryCode,
        config_key: configKey,
      });

      const config = response.country_delivery_configs?.[0];
      if (!config) {
        this.logger.warn(
          `Delivery config not found: ${configKey} for country ${countryCode}`
        );
        return null;
      }

      return this.parseConfigValue(config.config_value, config.data_type);
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch delivery config ${configKey} for country ${countryCode}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all delivery configurations for a country
   * @param countryCode - ISO 3166-1 alpha-2 country code
   * @returns Map of config keys to their parsed values
   */
  async getAllDeliveryConfigs(countryCode: string): Promise<Map<string, any>> {
    try {
      const query = `
        query GetAllDeliveryConfigs($country_code: bpchar!) {
          country_delivery_configs(
            where: { country_code: { _eq: $country_code } }
          ) {
            config_key
            config_value
            data_type
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        country_code: countryCode,
      });

      const configs = new Map<string, any>();
      const results = response.country_delivery_configs || [];

      for (const config of results) {
        configs.set(
          config.config_key,
          this.parseConfigValue(config.config_value, config.data_type)
        );
      }

      return configs;
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch all delivery configs for country ${countryCode}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get fast delivery specific configuration
   * @param countryCode - ISO 3166-1 alpha-2 country code
   * @returns Fast delivery configuration object
   */
  async getFastDeliveryConfig(
    countryCode: string
  ): Promise<FastDeliveryConfig> {
    try {
      const [enabled, baseFee, sla, serviceHours] = await Promise.all([
        this.isFastDeliveryEnabled(countryCode),
        this.getFastDeliveryBaseFee(countryCode),
        this.getFastDeliverySLA(countryCode),
        this.getFastDeliveryServiceHours(countryCode),
      ]);

      return {
        enabled: enabled || false,
        baseFee: baseFee || 1500,
        sla: sla || 4,
        serviceHours: (serviceHours as any) || {},
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch fast delivery config for country ${countryCode}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get normal delivery base fee
   */
  async getNormalDeliveryBaseFee(countryCode: string): Promise<number> {
    const value = await this.getDeliveryConfig(
      countryCode,
      'normal_delivery_base_fee'
    );
    return typeof value === 'number' ? value : 1000; // Default fallback
  }

  /**
   * Get fast delivery base fee
   */
  async getFastDeliveryBaseFee(countryCode: string): Promise<number> {
    const value = await this.getDeliveryConfig(
      countryCode,
      'fast_delivery_base_fee'
    );
    return typeof value === 'number' ? value : 1500; // Default fallback
  }

  /**
   * Get per-kilometer delivery fee rate
   */
  async getPerKmDeliveryFee(countryCode: string): Promise<number> {
    const value = await this.getDeliveryConfig(
      countryCode,
      'per_km_delivery_fee'
    );
    return typeof value === 'number' ? value : 200; // Default fallback
  }

  /**
   * Get fast delivery SLA (maximum delivery time in hours)
   */
  async getFastDeliverySLA(countryCode: string): Promise<number> {
    const value = await this.getDeliveryConfig(
      countryCode,
      'fast_delivery_sla'
    );
    return typeof value === 'number' ? value : 4; // Default fallback
  }

  /**
   * Get fast delivery service hours configuration
   */
  async getFastDeliveryServiceHours(countryCode: string): Promise<object> {
    const value = await this.getDeliveryConfig(
      countryCode,
      'fast_delivery_service_hours'
    );
    return typeof value === 'object' && value !== null ? value : {};
  }

  /**
   * Check if fast delivery is enabled for a country
   */
  async isFastDeliveryEnabled(countryCode: string): Promise<boolean> {
    const value = await this.getDeliveryConfig(
      countryCode,
      'fast_delivery_enabled'
    );
    return typeof value === 'boolean' ? value : false;
  }

  /**
   * Get currency code for delivery fees
   */
  async getCurrency(countryCode: string): Promise<string> {
    const value = await this.getDeliveryConfig(countryCode, 'currency');
    return typeof value === 'string' ? value : 'XAF'; // Default fallback
  }

  /**
   * Get timezone for delivery operations
   */
  async getTimezone(countryCode: string): Promise<string> {
    const value = await this.getDeliveryConfig(countryCode, 'timezone');
    return typeof value === 'string' ? value : 'Africa/Libreville'; // Default fallback to UTC
  }

  /**
   * Parse configuration value based on data type
   */
  private parseConfigValue(
    value: string,
    dataType: string
  ): string | number | boolean | object {
    switch (dataType) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(value);
        } catch (e) {
          this.logger.warn(`Failed to parse JSON config value: ${value}`);
          return {};
        }
      case 'string':
      default:
        return value;
    }
  }
}
