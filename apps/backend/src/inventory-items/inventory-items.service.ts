import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface InventoryItem {
  id: string;
  business_location_id: string;
  item_id: string;
  computed_available_quantity: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
    item: {
      id: string;
      name: string;
      description: string;
      price: number;
      currency: string;
      weight: number;
      weight_unit: string;
      dimensions?: string | null;
      item_sub_category_id: number;
    sku: string;
    brand: {
      id: string;
      name: string;
    };
    model: string;
    color: string;
    is_fragile: boolean;
    is_perishable: boolean;
    requires_special_handling: boolean;
    max_delivery_distance: number;
    estimated_delivery_time: number;
    min_order_quantity: number;
    max_order_quantity: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    item_sub_category: {
      id: number;
      name: string;
      item_category: {
        id: number;
        name: string;
      };
    };
    item_images: Array<{
      id: string;
      image_url: string;
      image_type: string;
      alt_text?: string;
      caption?: string;
      display_order: number;
    }>;
  };
  business_location: {
    id: string;
    business_id: string;
    name: string;
    location_type: string;
    is_primary: boolean;
    business: {
      id: string;
      name: string;
      is_verified: boolean;
    };
    address: {
      id: string;
      address_line_1: string;
      address_line_2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface GetInventoryItemsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  is_active?: boolean;
  country_code?: string;
  state?: string;
}

export interface PaginatedInventoryItems {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class InventoryItemsService {
  private readonly logger = new Logger(InventoryItemsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  /**
   * Get paginated inventory items with optional filters.
   * When a valid JWT is present, uses the logged-in user's primary address for country_code/state.
   * Otherwise uses query params (e.g. from anonymous users).
   */
  async getInventoryItems(
    query: GetInventoryItemsQuery = {}
  ): Promise<PaginatedInventoryItems> {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      brand,
      min_price,
      max_price,
      currency,
      is_active = true,
      country_code: queryCountryCode,
      state: queryState,
    } = query;

    // Resolve country_code and state: prefer logged-in user's address when JWT present
    let country_code = queryCountryCode;
    let state = queryState;
    try {
      const user = await this.hasuraUserService.getUser();
      const addresses = user.addresses;
      if (addresses?.length) {
        const primary =
          addresses.find((a) => a.is_primary === true) ?? addresses[0];
        if (primary?.country) {
          country_code = primary.country;
          state = primary.state ?? state;
        }
      }
    } catch {
      // Anonymous or invalid token: use query params as-is
    }

    // Build where conditions
    const whereConditions: any[] = [];

    // Only show active items by default
    whereConditions.push({ is_active: { _eq: is_active } });

    // Only show items from verified businesses
    whereConditions.push({
      business_location: {
        business: { is_verified: { _eq: true } },
      },
    });

    // Search filter
    if (search) {
      whereConditions.push({
        _or: [
          { item: { name: { _ilike: `%${search}%` } } },
          { item: { description: { _ilike: `%${search}%` } } },
          { item: { sku: { _ilike: `%${search}%` } } },
          { item: { brand: { name: { _ilike: `%${search}%` } } } },
        ],
      });
    }

    // Category filter
    if (category) {
      whereConditions.push({
        item: {
          item_sub_category: {
            item_category: { name: { _ilike: `%${category}%` } },
          },
        },
      });
    }

    // Brand filter
    if (brand) {
      whereConditions.push({
        item: { brand: { name: { _ilike: `%${brand}%` } } },
      });
    }

    // Price filters
    if (min_price !== undefined) {
      whereConditions.push({ selling_price: { _gte: min_price } });
    }
    if (max_price !== undefined) {
      whereConditions.push({ selling_price: { _lte: max_price } });
    }

    // Currency filter
    if (currency) {
      whereConditions.push({ item: { currency: { _eq: currency } } });
    }

    // Location filtering - only show items from supported locations
    // First, validate that requested location is supported
    if (country_code || state) {
      const isLocationSupported = await this.validateLocationSupport(
        country_code,
        state
      );
      if (!isLocationSupported) {
        // Return empty results if location is not supported
        return {
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
    }

    // Build location filter
    let supportedLocationFilter: any = {};

    if (country_code || state) {
      // If specific country/state is requested, filter by it
      const locationConditions: any[] = [];

      if (country_code) {
        locationConditions.push({
          business_location: {
            address: { country: { _eq: country_code } },
          },
        });
      }

      if (state) {
        locationConditions.push({
          business_location: {
            address: { state: { _eq: state } },
          },
        });
      }

      supportedLocationFilter = { _and: locationConditions };
    } else {
      // If no specific location requested, still filter by supported locations only
      // This ensures we only show items from countries/states that are supported
      supportedLocationFilter = {
        business_location: {
          address: {
            country: {
              _in: await this.getSupportedCountryCodes(),
            },
          },
        },
      };
    }

    whereConditions.push(supportedLocationFilter);

    const where = whereConditions.length > 0 ? { _and: whereConditions } : {};

    // Calculate offset
    const offset = (page - 1) * limit;

    const queryString = `
      query GetInventoryItems($where: business_inventory_bool_exp!, $limit: Int!, $offset: Int!) {
        business_inventory(where: $where, limit: $limit, offset: $offset, order_by: {created_at: desc}) {
          id
          business_location_id
          item_id
          computed_available_quantity
          selling_price
          is_active
          created_at
          updated_at
          item {
            id
            name
            description
            price
            currency
            weight
            weight_unit
            dimensions
            item_sub_category_id
            sku
            brand {
              id
              name
            }
            model
            color
            is_fragile
            is_perishable
            requires_special_handling
            max_delivery_distance
            estimated_delivery_time
            min_order_quantity
            max_order_quantity
            is_active
            created_at
            updated_at
            item_sub_category {
              id
              name
              item_category {
                id
                name
              }
            }
            item_images {
              id
              image_url
              image_type
              alt_text
              caption
              display_order
            }
          }
          business_location {
            id
            business_id
            name
            location_type
            is_primary
            business {
              id
              name
              is_verified
            }
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
          }
        }
        business_inventory_aggregate(where: $where) {
          aggregate {
            count
          }
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(queryString, {
        where,
        limit,
        offset,
      });

      const items = result.business_inventory || [];
      const total = result.business_inventory_aggregate?.aggregate?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        items,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to fetch inventory items:', error);
      throw new HttpException(
        'Failed to fetch inventory items',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get a specific inventory item by ID
   */
  async getInventoryItemById(id: string): Promise<InventoryItem> {
    const queryString = `
      query GetInventoryItem($id: uuid!) {
        business_inventory_by_pk(id: $id) {
          id
          business_location_id
          item_id
          computed_available_quantity
          selling_price
          is_active
          created_at
          updated_at
          item {
            id
            name
            description
            price
            currency
            weight
            weight_unit
            dimensions
            item_sub_category_id
            sku
            brand {
              id
              name
            }
            model
            color
            is_fragile
            is_perishable
            requires_special_handling
            max_delivery_distance
            estimated_delivery_time
            min_order_quantity
            max_order_quantity
            is_active
            created_at
            updated_at
            item_sub_category {
              id
              name
              item_category {
                id
                name
              }
            }
            item_images {
              id
              image_url
              image_type
              alt_text
              caption
              display_order
            }
          }
          business_location {
            id
            business_id
            name
            location_type
            is_primary
            business {
              id
              name
              is_verified
            }
            address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
          }
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(queryString, {
        id,
      });

      const item = result.business_inventory_by_pk;

      if (!item) {
        throw new HttpException(
          'Inventory item not found',
          HttpStatus.NOT_FOUND
        );
      }

      return item;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to fetch inventory item ${id}:`, error);
      throw new HttpException(
        'Failed to fetch inventory item',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Validate if a location (country/state) is supported for delivery
   */
  private async validateLocationSupport(
    countryCode?: string,
    state?: string
  ): Promise<boolean> {
    try {
      const whereClause: any = {
        service_status: { _eq: 'active' },
        delivery_enabled: { _eq: true },
        ...(countryCode && { country_code: { _eq: countryCode } }),
        ...(state && { state_name: { _eq: state } }),
      };

      const query = `
        query ValidateLocationSupport($where: supported_country_states_bool_exp!) {
          supported_country_states(where: $where, limit: 1) {
            id
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query, {
        where: whereClause,
      });
      const locations = response.supported_country_states || [];

      return locations.length > 0;
    } catch (error) {
      this.logger.error('Failed to validate location support:', error);
      return false;
    }
  }

  /**
   * Get list of supported country codes from supported_country_states table
   */
  private async getSupportedCountryCodes(): Promise<string[]> {
    try {
      const query = `
        query GetSupportedCountryCodes {
          supported_country_states(
            where: { 
              service_status: { _eq: "active" },
              delivery_enabled: { _eq: true }
            },
            distinct_on: [country_code]
          ) {
            country_code
          }
        }
      `;

      const response = await this.hasuraSystemService.executeQuery(query);
      const locations = response.supported_country_states || [];

      return locations.map((loc: any) => loc.country_code);
    } catch (error) {
      this.logger.error('Failed to fetch supported country codes:', error);
      // Return empty array as fallback - this will show no items if there's an error
      return [];
    }
  }
}
