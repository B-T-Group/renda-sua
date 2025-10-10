import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export interface SupportedLocation {
  id: string;
  countryCode: string;
  countryName: string;
  stateCode: string | null;
  stateName: string;
  currencyCode: string;
  serviceStatus: 'active' | 'coming_soon' | 'suspended' | 'inactive';
  deliveryEnabled: boolean;
  fastDelivery: {
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
  };
  supportedPaymentMethods: string[];
  launchDate: string | null;
}

export interface LocationSupportCheck {
  supported: boolean;
  location: {
    country: {
      code: string;
      name: string;
      supported: boolean;
      serviceStatus: string;
    };
    state?: {
      code: string;
      name: string;
      supported: boolean;
      serviceStatus: string;
    };
    deliveryOptions: {
      standardDelivery: {
        enabled: boolean;
        estimatedTime: string;
      };
      fastDelivery: {
        enabled: boolean;
        estimatedTime: string;
        additionalFee: number;
        operatingHours: any;
      };
    };
    restrictions: {
      supportedPaymentMethods: string[];
    };
  };
}

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  private readonly logger = new Logger(LocationsController.name);

  constructor(private readonly hasuraService: HasuraSystemService) {}

  @Get('supported')
  @ApiOperation({
    summary: 'Get all supported delivery locations',
    description:
      'Returns list of countries and states where delivery service is available',
  })
  @ApiResponse({
    status: 200,
    description: 'Supported locations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        locations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid' },
              countryCode: { type: 'string', example: 'GA' },
              countryName: { type: 'string', example: 'Gabon' },
              stateCode: { type: 'string', example: 'Littoral' },
              stateName: { type: 'string', example: 'Littoral Province' },
              currencyCode: { type: 'string', example: 'XAF' },
              serviceStatus: { type: 'string', example: 'active' },
              deliveryEnabled: { type: 'boolean', example: true },
              fastDelivery: { type: 'object' },
              supportedPaymentMethods: {
                type: 'array',
                items: { type: 'string' },
              },
              launchDate: { type: 'string', example: '2024-01-01' },
            },
          },
        },
      },
    },
  })
  async getSupportedLocations(): Promise<{
    success: boolean;
    locations: SupportedLocation[];
  }> {
    try {
      const query = `
        query GetSupportedLocations {
          supported_country_states(
            where: { service_status: { _in: ["active", "coming_soon"] } }
            order_by: { country_code: asc, state_name: asc }
          ) {
            id
            country_code
            country_name
            state_code
            state_name
            currency_code
            service_status
            delivery_enabled
            fast_delivery
            supported_payment_methods
            launch_date
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query);
      const locations = response.supported_country_states || [];

      // Transform the data to match the interface
      const transformedLocations: SupportedLocation[] = locations.map(
        (loc: any) => ({
          id: loc.id,
          countryCode: loc.country_code,
          countryName: loc.country_name,
          stateCode: loc.state_code,
          stateName: loc.state_name,
          currencyCode: loc.currency_code,
          serviceStatus: loc.service_status,
          deliveryEnabled: loc.delivery_enabled,
          fastDelivery: loc.fast_delivery || {
            enabled: false,
            fee: 0,
            minHours: 0,
            maxHours: 0,
            operatingHours: {},
          },
          supportedPaymentMethods: loc.supported_payment_methods || [],
          launchDate: loc.launch_date,
        })
      );

      return {
        success: true,
        locations: transformedLocations,
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch supported locations', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to fetch supported locations',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('check-support')
  @ApiOperation({
    summary: 'Check if delivery is supported for a specific location',
    description:
      'Validates if delivery service is available for the given country and state',
  })
  @ApiQuery({
    name: 'countryCode',
    required: true,
    type: String,
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'GA',
  })
  @ApiQuery({
    name: 'stateCode',
    required: false,
    type: String,
    description: 'State/province code',
    example: 'Littoral',
  })
  @ApiResponse({
    status: 200,
    description: 'Location support check completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        supported: { type: 'boolean', example: true },
        location: { type: 'object' },
      },
    },
  })
  async checkLocationSupport(
    @Query('countryCode') countryCode: string,
    @Query('stateCode') stateCode?: string
  ): Promise<{
    success: boolean;
    supported: boolean;
    location: LocationSupportCheck['location'];
  }> {
    try {
      if (!countryCode) {
        throw new HttpException(
          'Country code is required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Build the query based on whether stateCode is provided
      let query: string;
      let variables: any;

      if (stateCode) {
        query = `
          query CheckLocationSupport($country_code: bpchar!, $state_code: String!) {
            supported_country_states(
              where: { 
                country_code: { _eq: $country_code },
                state_code: { _eq: $state_code }
              }
            ) {
              id
              country_code
              country_name
              state_code
              state_name
              currency_code
              service_status
              delivery_enabled
              fast_delivery
              supported_payment_methods
            }
          }
        `;
        variables = { country_code: countryCode, state_code: stateCode };
      } else {
        query = `
          query CheckCountrySupport($country_code: bpchar!) {
            supported_country_states(
              where: { country_code: { _eq: $country_code } }
              limit: 1
            ) {
              id
              country_code
              country_name
              state_code
              state_name
              currency_code
              service_status
              delivery_enabled
              fast_delivery
              supported_payment_methods
            }
          }
        `;
        variables = { country_code: countryCode };
      }

      const response = await this.hasuraService.executeQuery(query, variables);
      const locations = response.supported_country_states || [];

      if (locations.length === 0) {
        return {
          success: true,
          supported: false,
          location: {
            country: {
              code: countryCode,
              name: countryCode,
              supported: false,
              serviceStatus: 'inactive',
            },
            deliveryOptions: {
              standardDelivery: {
                enabled: false,
                estimatedTime: 'Not available',
              },
              fastDelivery: {
                enabled: false,
                estimatedTime: 'Not available',
                additionalFee: 0,
                operatingHours: {},
              },
            },
            restrictions: {
              supportedPaymentMethods: [],
            },
          },
        };
      }

      const location = locations[0];
      const fastDelivery = location.fast_delivery || {
        enabled: false,
        fee: 0,
        minHours: 0,
        maxHours: 0,
        operatingHours: {},
      };

      const supported =
        location.service_status === 'active' && location.delivery_enabled;

      return {
        success: true,
        supported,
        location: {
          country: {
            code: location.country_code,
            name: location.country_name,
            supported: location.service_status === 'active',
            serviceStatus: location.service_status,
          },
          ...(stateCode && {
            state: {
              code: location.state_code,
              name: location.state_name,
              supported: location.service_status === 'active',
              serviceStatus: location.service_status,
            },
          }),
          deliveryOptions: {
            standardDelivery: {
              enabled: location.delivery_enabled,
              estimatedTime: location.delivery_enabled
                ? '24-48 hours'
                : 'Not available',
            },
            fastDelivery: {
              enabled: fastDelivery.enabled,
              estimatedTime: fastDelivery.enabled
                ? `${fastDelivery.minHours}-${fastDelivery.maxHours} hours`
                : 'Not available',
              additionalFee: fastDelivery.fee || 0,
              operatingHours: fastDelivery.operatingHours || {},
            },
          },
          restrictions: {
            supportedPaymentMethods: location.supported_payment_methods || [],
          },
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to check location support', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to check location support',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('countries')
  @ApiOperation({
    summary: 'Get supported countries',
    description:
      'Returns list of countries where delivery service is available',
  })
  @ApiResponse({
    status: 200,
    description: 'Supported countries retrieved successfully',
  })
  async getSupportedCountries(): Promise<{
    success: boolean;
    countries: Array<{
      code: string;
      name: string;
      currencyCode: string;
      serviceStatus: string;
      deliveryEnabled: boolean;
      statesCount: number;
    }>;
  }> {
    try {
      const query = `
        query GetSupportedCountries {
          supported_country_states(
            where: { service_status: { _in: ["active", "coming_soon"] } }
            order_by: { country_code: asc }
          ) {
            country_code
            country_name
            currency_code
            service_status
            delivery_enabled
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query);
      const locations = response.supported_country_states || [];

      // Group by country and count states
      const countryMap = new Map();
      locations.forEach((loc: any) => {
        const key = loc.country_code;
        if (!countryMap.has(key)) {
          countryMap.set(key, {
            code: loc.country_code,
            name: loc.country_name,
            currencyCode: loc.currency_code,
            serviceStatus: loc.service_status,
            deliveryEnabled: loc.delivery_enabled,
            statesCount: 0,
          });
        }
        countryMap.get(key).statesCount++;
      });

      return {
        success: true,
        countries: Array.from(countryMap.values()),
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch supported countries', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to fetch supported countries',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('states')
  @ApiOperation({
    summary: 'Get supported states for a country',
    description:
      'Returns list of states/regions where delivery is available in a specific country',
  })
  @ApiQuery({
    name: 'countryCode',
    required: true,
    type: String,
    description: 'Country code (ISO 3166-1 alpha-2)',
    example: 'GA',
  })
  @ApiResponse({
    status: 200,
    description: 'Supported states retrieved successfully',
  })
  async getSupportedStates(@Query('countryCode') countryCode: string): Promise<{
    success: boolean;
    states: Array<{
      code: string;
      name: string;
      serviceStatus: string;
      deliveryEnabled: boolean;
      fastDeliveryEnabled: boolean;
    }>;
  }> {
    try {
      if (!countryCode) {
        throw new HttpException(
          'Country code is required',
          HttpStatus.BAD_REQUEST
        );
      }

      const query = `
        query GetSupportedStates($country_code: bpchar!) {
          supported_country_states(
            where: { 
              country_code: { _eq: $country_code },
              service_status: { _in: ["active", "coming_soon"] }
            }
            order_by: { state_name: asc }
          ) {
            state_code
            state_name
            service_status
            delivery_enabled
            fast_delivery
          }
        }
      `;

      const response = await this.hasuraService.executeQuery(query, {
        country_code: countryCode,
      });
      const locations = response.supported_country_states || [];

      const states = locations.map((loc: any) => ({
        code: loc.state_code,
        name: loc.state_name,
        serviceStatus: loc.service_status,
        deliveryEnabled: loc.delivery_enabled,
        fastDeliveryEnabled: loc.fast_delivery?.enabled || false,
      }));

      return {
        success: true,
        states,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to fetch supported states', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to fetch supported states',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
