import { useEffect, useRef } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

const GET_INVENTORY_ITEMS = `
  query GetInventoryItems {
    business_inventory {
      id
      business_location_id
      item_id
      available_quantity
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

export interface InventoryItem {
  id: string;
  business_location_id: string;
  item_id: string;
  available_quantity: number;
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

export const useInventoryItems = () => {
  const { data, loading, error, execute, refetch } = useGraphQLRequest<{
    business_inventory: InventoryItem[];
  }>(GET_INVENTORY_ITEMS);

  const hasExecuted = useRef(false);

  useEffect(() => {
    if (!hasExecuted.current) {
      hasExecuted.current = true;
      // Use setTimeout to ensure this runs after the component has mounted
      setTimeout(() => {
        execute();
      }, 0);
    }
  }, []); // Empty dependency array

  const inventoryItems: InventoryItem[] = data?.business_inventory || [];

  return {
    inventoryItems,
    loading,
    error,
    refetch: () => refetch(),
  };
};
