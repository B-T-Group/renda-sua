import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';

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
    size: number;
    size_unit: string;
    item_sub_category_id: number;
    sku: string;
    brand: {
      id: string;
      name: string;
    };
    model: string;
    color: string;
    material: string;
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

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  /**
   * Get paginated inventory items with optional filters
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
    } = query;

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
            size
            size_unit
            item_sub_category_id
            sku
            brand {
              id
              name
            }
            model
            color
            material
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
            size
            size_unit
            item_sub_category_id
            sku
            brand {
              id
              name
            }
            model
            color
            material
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
}
