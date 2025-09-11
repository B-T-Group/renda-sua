import { useCallback, useEffect, useState } from 'react';
import { ItemImage } from '../types/image';
import { useDistanceMatrix } from './useDistanceMatrix';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface Item {
  id: string;
  name: string;
  description: string;
  item_sub_category_id: number;
  weight: number | null;
  weight_unit: string | null;
  price: number;
  currency: string;
  sku: string | null;
  brand_id: string | null;
  model: string | null;
  color: string | null;
  is_fragile: boolean;
  is_perishable: boolean;
  requires_special_handling: boolean;
  max_delivery_distance: number | null;
  estimated_delivery_time: number | null;
  min_order_quantity: number;
  max_order_quantity: number | null;
  is_active: boolean;
  business_id: string;
  created_at: string;
  updated_at: string;
  business?: {
    id: string;
    name: string;
    is_verified: boolean;
  };
  brand?: {
    id: string;
    name: string;
    description: string;
  };
  item_sub_category?: {
    id: number;
    name: string;
    item_category: {
      id: number;
      name: string;
    };
  };
  item_images?: ItemImage[];
  business_inventories?: {
    id: string;
    item_id: string;
    business_location_id: string;
    quantity: number;
    computed_available_quantity: number;
    reserved_quantity: number;
    selling_price: number;
    unit_cost: number;
    reorder_point: number;
    reorder_quantity: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    business_location: {
      id: string;
      name: string;
      address_id: string;
    };
  }[];
  estimated_delivery_time_text?: string | null;
  estimated_distance_text?: string | null;
}

export interface Brand {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface CreateItemData {
  name: string;
  description: string;
  item_sub_category_id: number;
  weight?: number;
  weight_unit?: string;
  price: number;
  currency: string;
  sku?: string;
  brand_id?: string;
  model?: string;
  color?: string;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  max_delivery_distance?: number;
  estimated_delivery_time?: number;
  min_order_quantity?: number;
  max_order_quantity?: number;
  is_active?: boolean;
  business_id: string;
}

export interface CreateBrandData {
  name: string;
  description: string;
}

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

const GET_BRANDS = `
  query GetBrands {
    brands(
      order_by: { name: asc }
    ) {
      id
      name
      description
      created_at
      updated_at
    }
  }
`;

const GET_ITEM_SUB_CATEGORIES = `
  query GetItemSubCategories {
    item_sub_categories(
      order_by: { name: asc }
    ) {
      id
      name
      description
      item_category {
        id
        name
      }
    }
  }
`;

const GET_SINGLE_ITEM = `
  query GetSingleItem($id: uuid!) {
    items_by_pk(id: $id) {
      id
      name
      description
      item_sub_category_id
      weight
      weight_unit
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
        business_location_id
        quantity
        computed_available_quantity
        reserved_quantity
        reorder_point
        reorder_quantity
        unit_cost
        selling_price
        is_active
        last_restocked_at
        created_at
        updated_at
        business_location {
          id
          name
          location_type
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
  }
`;

export const useItems = (businessId?: string) => {
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [itemSubCategories, setItemSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute: executeItemsQuery } = useGraphQLRequest(GET_ITEMS);
  const { execute: executeSingleItemQuery } =
    useGraphQLRequest(GET_SINGLE_ITEM);
  const { execute: executeBrandsQuery } = useGraphQLRequest(GET_BRANDS);
  const { execute: executeSubCategoriesQuery } = useGraphQLRequest(
    GET_ITEM_SUB_CATEGORIES
  );
  const { fetchDistanceMatrix } = useDistanceMatrix();

  // Create item mutation
  const createItemMutation = `
    mutation CreateItem($itemData: items_insert_input!) {
      insert_items_one(object: $itemData) {
        id
        name
        description
        item_sub_category_id
        size
        size_unit
        weight
        weight_unit
        price
        currency
        sku
        brand_id
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
      }
    }
  `;
  const { execute: executeCreateItem } = useGraphQLRequest(createItemMutation);

  // Create brand mutation
  const createBrandMutation = `
    mutation CreateBrand($brandData: brands_insert_input!) {
      insert_brands_one(object: $brandData) {
        id
        name
        description
        created_at
        updated_at
      }
    }
  `;
  const { execute: executeCreateBrand } =
    useGraphQLRequest(createBrandMutation);

  // Update item mutation
  const updateItemMutation = `
    mutation UpdateItem($id: uuid!, $itemData: items_set_input!) {
      update_items_by_pk(
        pk_columns: { id: $id }
        _set: $itemData
      ) {
        id
        name
        description
        item_sub_category_id
        size
        size_unit
        weight
        weight_unit
        price
        currency
        sku
        brand_id
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
      }
    }
  `;
  const { execute: executeUpdateItem } = useGraphQLRequest(updateItemMutation);

  const fetchItems = useCallback(
    async (withDistanceMatrix = true) => {
      if (!businessId) {
        console.log('useItems: No businessId provided, skipping fetch');
        return;
      }

      console.log('useItems: Fetching items for businessId:', businessId);
      setLoading(true);
      setError(null);

      try {
        const result = await executeItemsQuery({ businessId });
        console.log('useItems: Fetch result:', result);
        const fetchedItems = result.items || [];
        // Collect unique destination address IDs from all business_inventories
        const allAddressIds = fetchedItems
          .flatMap((item: any) =>
            (item.business_inventories || []).map((inv: any) =>
              String(inv.business_location?.address_id)
            )
          )
          .filter(Boolean);
        const uniqueAddressIds: string[] = Array.from(new Set(allAddressIds));
        // Call distance-matrix API if there are addresses
        let distanceMatrix: any = null;
        if (uniqueAddressIds.length > 0 && withDistanceMatrix) {
          try {
            distanceMatrix = await fetchDistanceMatrix({
              destination_address_ids: uniqueAddressIds,
            });
          } catch (e) {
            console.warn('Failed to fetch distance matrix:', e);
          }
        }
        // Map distances/times to items
        const updatedItems = fetchedItems.map((item: any) => {
          let estDeliveryTime: string | null = null;
          let estDistance: string | null = null;
          const addressId =
            item.business_inventories?.[0]?.business_location?.address_id;
          if (distanceMatrix && addressId) {
            const idx = distanceMatrix.destination_ids.indexOf(addressId);
            if (idx !== -1 && distanceMatrix.rows[0]?.elements[idx]) {
              const el = distanceMatrix.rows[0].elements[idx];
              estDeliveryTime = el.duration?.text || null;
              estDistance = el.distance?.text || null;
            }
          }
          return {
            ...item,
            estimated_delivery_time_text: estDeliveryTime,
            estimated_distance_text: estDistance,
          };
        });
        setItems(updatedItems);
      } catch (err) {
        console.error('useItems: Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch items');
      } finally {
        setLoading(false);
      }
    },
    [businessId]
  );

  const fetchSingleItem = useCallback(
    async (itemId: string) => {
      setLoading(true);
      setError(null);

      try {
        const result = await executeSingleItemQuery({ id: itemId });
        return result.items_by_pk;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch item');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [executeSingleItemQuery]
  );

  const fetchBrands = useCallback(async () => {
    try {
      const result = await executeBrandsQuery();
      setBrands(result.brands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch brands');
    }
  }, [executeBrandsQuery]);

  const fetchItemSubCategories = useCallback(async () => {
    try {
      const result = await executeSubCategoriesQuery();
      setItemSubCategories(result.item_sub_categories || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch item sub categories'
      );
    }
  }, [executeSubCategoriesQuery]);

  const createItem = useCallback(
    async (itemData: CreateItemData) => {
      // Ensure business_id is provided
      if (!itemData.business_id) {
        throw new Error('business_id is required for creating items');
      }

      try {
        const result = await executeCreateItem({ itemData });

        // Refresh items after creating
        await fetchItems();

        return result.insert_items_one;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create item');
        throw err;
      }
    },
    [executeCreateItem, fetchItems]
  );

  const createBrand = useCallback(
    async (brandData: CreateBrandData) => {
      try {
        const result = await executeCreateBrand({ brandData });

        // Refresh brands after creating
        await fetchBrands();

        return result.insert_brands_one;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create brand');
        throw err;
      }
    },
    [executeCreateBrand, fetchBrands]
  );

  const updateItem = useCallback(
    async (id: string, itemData: Partial<CreateItemData>) => {
      try {
        const result = await executeUpdateItem({ id, itemData });

        // Refresh items after updating
        await fetchItems();

        return result.update_items_by_pk;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update item');
        throw err;
      }
    },
    [executeUpdateItem, fetchItems]
  );

  useEffect(() => {
    console.log('useItems: useEffect triggered, businessId:', businessId);
    if (businessId) {
      fetchItems(false);
    }
  }, [businessId]);

  return {
    items,
    brands,
    itemSubCategories,
    loading,
    error,
    fetchItems,
    fetchSingleItem,
    fetchBrands,
    fetchItemSubCategories,
    createItem,
    createBrand,
    updateItem,
  };
};
