import { Injectable } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';

const GET_ITEMS = `
  query GetItems($businessId: uuid!) {
    items(
      where: { business_id: { _eq: $businessId } }
      order_by: { name: asc }
    ) {
      id
      name
      description
      item_sub_category_id
      weight
      weight_unit
      dimensions
      price
      currency
      sku
      brand_id
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
      business_id
      created_at
      updated_at
      brand {
        id
        name
        description
      }
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
        display_order
        created_at
      }
      business_inventories {
        id
        item_id
        business_location_id
        quantity
        computed_available_quantity
        reserved_quantity
        selling_price
        unit_cost
        reorder_point
        reorder_quantity
        is_active
        created_at
        updated_at
        business_location {
          id
          name
          address_id
        }
      }
    }
  }
`;

const GET_BUSINESS_LOCATIONS = `
  query GetBusinessLocations($businessId: uuid!) {
    business_locations(
      where: { business_id: { _eq: $businessId } }
      order_by: { name: asc }
    ) {
      id
      name
      location_type
      is_primary
      created_at
      updated_at
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
`;

const GET_AVAILABLE_ITEMS = `
  query GetAvailableItems {
    items(
      where: { 
        is_active: { _eq: true },
        business: { is_verified: { _eq: true } }
      }
      order_by: { name: asc }
    ) {
      id
      name
      description
      price
      currency
      weight
      weight_unit
      sku
      brand {
        id
        name
        description
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
      business {
        id
        name
        is_verified
      }
    }
  }
`;

@Injectable()
export class BusinessItemsService {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async getItems(businessId: string) {
    const result = await this.hasuraUserService.executeQuery<{ items: any[] }>(
      GET_ITEMS,
      { businessId }
    );
    return result.items ?? [];
  }

  async getBusinessLocations(businessId: string) {
    const result =
      await this.hasuraUserService.executeQuery<{
        business_locations: any[];
      }>(GET_BUSINESS_LOCATIONS, { businessId });
    return result.business_locations ?? [];
  }

  async getAvailableItems() {
    const result = await this.hasuraUserService.executeQuery<{ items: any[] }>(
      GET_AVAILABLE_ITEMS
    );
    return result.items ?? [];
  }
}
