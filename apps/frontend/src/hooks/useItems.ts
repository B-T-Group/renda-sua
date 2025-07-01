import { useCallback, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface Item {
  id: string;
  name: string;
  description: string;
  item_sub_category_id: number;
  size: number | null;
  size_unit: string | null;
  weight: number | null;
  weight_unit: string | null;
  price: number;
  currency: string;
  sku: string | null;
  brand_id: string | null;
  model: string | null;
  color: string | null;
  material: string | null;
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
  size?: number;
  size_unit?: string;
  weight?: number;
  weight_unit?: string;
  price: number;
  currency: string;
  sku?: string;
  brand_id?: string;
  model?: string;
  color?: string;
  material?: string;
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

export const useItems = (businessId?: string) => {
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [itemSubCategories, setItemSubCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute: executeItemsQuery } = useGraphQLRequest(GET_ITEMS);
  const { execute: executeBrandsQuery } = useGraphQLRequest(GET_BRANDS);
  const { execute: executeSubCategoriesQuery } = useGraphQLRequest(
    GET_ITEM_SUB_CATEGORIES
  );

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

  const fetchItems = useCallback(async () => {
    if (!businessId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await executeItemsQuery({ businessId });
      setItems(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, [executeItemsQuery, businessId]);

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

  return {
    items,
    brands,
    itemSubCategories,
    loading,
    error,
    fetchItems,
    fetchBrands,
    fetchItemSubCategories,
    createItem,
    createBrand,
    updateItem,
  };
};
