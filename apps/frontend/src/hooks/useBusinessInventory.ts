import { useCallback, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface BusinessInventoryItem {
  id: string;
  business_location_id: string;
  item_id: string;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: number;
  is_active: boolean;
  last_restocked_at: string | null;
  created_at: string;
  updated_at: string;
  business_location: {
    id: string;
    name: string;
    location_type: string;
    address: {
      id: string;
      address_line_1: string;
      address_line_2: string | null;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  item: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    weight: number | null;
    weight_unit: string | null;
    size: string | null;
    size_unit: string | null;
    sku: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
    material: string | null;
    is_fragile: boolean;
    is_perishable: boolean;
    requires_special_handling: boolean;
    max_delivery_distance: number | null;
    estimated_delivery_time: number | null;
    min_order_quantity: number | null;
    max_order_quantity: number | null;
    is_active: boolean;
  };
}

export interface AddInventoryItemData {
  business_location_id: string;
  item_id: string;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  reorder_point: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price: number;
  is_active: boolean;
}

const GET_BUSINESS_INVENTORY = `
  query GetBusinessInventory {
    business_inventory(
      order_by: { created_at: desc }
    ) {
      id
      business_location_id
      item_id
      quantity
      available_quantity
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
        sku
        brand {
          id
          name
          description
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
      }
    }
  }
`;

const GET_AVAILABLE_ITEMS = `
  query GetAvailableItems {
    items(
      where: { is_active: { _eq: true } }
      order_by: { name: asc }
    ) {
      id
      name
      description
      price
      currency
      weight
      weight_unit
      size
      size_unit
      sku
      brand {
        id
        name
        description
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
    }
  }
`;

const GET_BUSINESS_LOCATIONS = `
  query GetBusinessLocations {
    business_locations(
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

export const useBusinessInventory = () => {
  const [inventory, setInventory] = useState<BusinessInventoryItem[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [businessLocations, setBusinessLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute: executeInventoryQuery } = useGraphQLRequest(
    GET_BUSINESS_INVENTORY
  );
  const { execute: executeItemsQuery } = useGraphQLRequest(GET_AVAILABLE_ITEMS);
  const { execute: executeLocationsQuery } = useGraphQLRequest(
    GET_BUSINESS_LOCATIONS
  );

  // Create mutation hooks at the top level
  const addInventoryMutation = `
    mutation AddInventoryItem($itemData: business_inventory_insert_input!) {
      insert_business_inventory_one(object: $itemData) {
        id
        business_location_id
        item_id
        quantity
        available_quantity
        reserved_quantity
        reorder_point
        reorder_quantity
        unit_cost
        selling_price
        is_active
        last_restocked_at
        created_at
        updated_at
      }
    }
  `;
  const { execute: executeAddMutation } =
    useGraphQLRequest(addInventoryMutation);

  const updateInventoryMutation = `
    mutation UpdateInventoryItem($itemId: uuid!, $updates: business_inventory_set_input!) {
      update_business_inventory_by_pk(
        pk_columns: { id: $itemId }
        _set: $updates
      ) {
        id
        quantity
        available_quantity
        reserved_quantity
        reorder_point
        reorder_quantity
        unit_cost
        selling_price
        is_active
        last_restocked_at
        updated_at
      }
    }
  `;
  const { execute: executeUpdateMutation } = useGraphQLRequest(
    updateInventoryMutation
  );

  const deleteInventoryMutation = `
    mutation DeleteInventoryItem($itemId: uuid!) {
      delete_business_inventory_by_pk(id: $itemId) {
        id
      }
    }
  `;
  const { execute: executeDeleteMutation } = useGraphQLRequest(
    deleteInventoryMutation
  );

  const restockItemMutation = `
    mutation RestockItem($itemId: uuid!, $quantity: Int!) {
      update_business_inventory_by_pk(
        pk_columns: { id: $itemId }
        _inc: { 
          quantity: $quantity,
          available_quantity: $quantity
        }
        _set: { 
          last_restocked_at: "now()",
          updated_at: "now()"
        }
      ) {
        id
        quantity
        available_quantity
        last_restocked_at
        updated_at
      }
    }
  `;
  const { execute: executeRestockMutation } =
    useGraphQLRequest(restockItemMutation);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await executeInventoryQuery();
      setInventory(result.business_inventory || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch inventory'
      );
    } finally {
      setLoading(false);
    }
  }, [executeInventoryQuery]);

  const fetchAvailableItems = useCallback(async () => {
    try {
      const result = await executeItemsQuery();
      setAvailableItems(result.items || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch available items'
      );
    }
  }, [executeItemsQuery]);

  const fetchBusinessLocations = useCallback(async () => {
    try {
      const result = await executeLocationsQuery();
      setBusinessLocations(result.business_locations || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch business locations'
      );
    }
  }, [executeLocationsQuery]);

  const addInventoryItem = useCallback(
    async (itemData: AddInventoryItemData) => {
      try {
        await executeAddMutation({ itemData });

        // Refresh inventory after adding item
        await fetchInventory();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to add inventory item'
        );
      }
    },
    [executeAddMutation, fetchInventory]
  );

  const updateInventoryItem = useCallback(
    async (itemId: string, updates: Partial<AddInventoryItemData>) => {
      try {
        await executeUpdateMutation({ itemId, updates });

        // Refresh inventory after updating item
        await fetchInventory();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update inventory item'
        );
      }
    },
    [executeUpdateMutation, fetchInventory]
  );

  const deleteInventoryItem = useCallback(
    async (itemId: string) => {
      try {
        await executeDeleteMutation({ itemId });

        // Refresh inventory after deleting item
        await fetchInventory();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete inventory item'
        );
      }
    },
    [executeDeleteMutation, fetchInventory]
  );

  const restockItem = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        await executeRestockMutation({ itemId, quantity });

        // Refresh inventory after restocking
        await fetchInventory();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restock item');
      }
    },
    [executeRestockMutation, fetchInventory]
  );

  return {
    inventory,
    availableItems,
    businessLocations,
    loading,
    error,
    fetchInventory,
    fetchAvailableItems,
    fetchBusinessLocations,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    restockItem,
  };
};
