import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';
import { Item } from './useItems';

interface PublicItemsResponse {
  items: Item[];
}

const GET_PUBLIC_ITEMS = `
  query GetPublicItems {
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
      business {
        id
        name
        is_verified
      }
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
    }
  }
`;

export const usePublicItems = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { baseClient } = useGraphQLClient();

  const fetchItems = useCallback(async () => {
    if (!baseClient) {
      setError('GraphQL client not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await baseClient.request<PublicItemsResponse>(
        GET_PUBLIC_ITEMS
      );

      if (response?.items) {
        setItems(response.items);
      } else {
        setError('Failed to fetch items - no data received');
      }
    } catch (err) {
      console.error('Error fetching public items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, [baseClient]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
  };
};
