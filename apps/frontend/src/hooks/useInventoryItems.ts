import { useCallback, useEffect, useState } from 'react';
import { ImageType } from '../types/image';
import { useApiClient } from './useApiClient';

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
      image_type: ImageType;
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

export interface ApiResponse {
  success: boolean;
  data: PaginatedInventoryItems;
  message: string;
}

export const useInventoryItems = (query: GetInventoryItemsQuery = {}) => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null>(null);

  const apiClient = useApiClient();

  const fetchInventoryItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ApiResponse>('/inventory-items', {
        params: {
          page: query.page || 1,
          limit: query.limit || 20,
          is_active: query.is_active !== undefined ? query.is_active : true,
          ...(query.search && { search: query.search }),
          ...(query.category && { category: query.category }),
          ...(query.brand && { brand: query.brand }),
          ...(query.min_price && { min_price: query.min_price }),
          ...(query.max_price && { max_price: query.max_price }),
          ...(query.currency && { currency: query.currency }),
        },
      });

      if (response.data.success) {
        setInventoryItems(response.data.data.items);
        setPagination({
          total: response.data.data.total,
          page: response.data.data.page,
          limit: response.data.data.limit,
          totalPages: response.data.data.totalPages,
        });
      } else {
        setError(response.data.message || 'Failed to fetch inventory items');
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
        (err as { message?: string })?.message ||
        'Failed to fetch inventory items';
      setError(errorMessage);
      console.error('Error fetching inventory items:', err);
    } finally {
      setLoading(false);
    }
  }, [apiClient, query]);

  useEffect(() => {
    fetchInventoryItems();
  }, [fetchInventoryItems]);

  const refetch = useCallback(() => {
    fetchInventoryItems();
  }, [fetchInventoryItems]);

  return {
    inventoryItems,
    loading,
    error,
    pagination,
    refetch,
  };
};
