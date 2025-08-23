import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderItem {
  id: string;
  item_name: string;
  item_description: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  weight: number;
  weight_unit: string;
  dimensions: string;
  special_instructions: string;
  item: {
    sku: string;
    currency: string;
    model: string;
    color: string;
    size: string;
    size_unit: string;
    weight: number;
    weight_unit: string;
    brand: {
      id: string;
      name: string;
    };
    item_sub_category: {
      id: string;
      name: string;
      item_category: {
        id: string;
        name: string;
      };
    };
    item_images: {
      id: string;
      image_url: string;
    }[];
  };
}

export interface OrderStatusHistory {
  id: string;
  status: string;
  previous_status: string;
  notes: string;
  changed_by_type: string;
  changed_by_user_id: string;
  created_at: string;
  changed_by_user: {
    agent?: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
      };
    };
    business?: {
      user: {
        email: string;
        first_name: string;
        last_name: string;
      };
    };
    client?: {
      user: {
        first_name: string;
        email: string;
        last_name: string;
      };
    };
  };
}

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id?: string;
  delivery_address_id: string;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  current_status: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  special_instructions?: string;
  preferred_delivery_time?: string;
  payment_method?: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  };
  business_location: {
    id: string;
    name: string;
    location_type: string;
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
  delivery_address: {
    id: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  assigned_agent?: {
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  };
  order_items: OrderItem[];
  order_status_history: OrderStatusHistory[];
}

export interface OrderFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

interface UseOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchOrders: (filters?: OrderFilters) => Promise<void>;
  refreshOrders: () => Promise<void>;
}

export const useOrders = (): UseOrdersReturn => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<OrderFilters | undefined>();
  const apiClient = useApiClient();

  const fetchOrders = useCallback(
    async (filters?: OrderFilters) => {
      setLoading(true);
      setError(null);
      setLastFilters(filters);

      try {
        if (!apiClient) {
          setError('API client not available');
          return;
        }

        const queryParams = new URLSearchParams();

        if (filters && Object.keys(filters).length > 0) {
          // Clean up filters - remove empty values
          const cleanFilters = Object.entries(filters).reduce(
            (acc, [key, value]) => {
              if (value !== '' && value !== null && value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as any
          );

          if (Object.keys(cleanFilters).length > 0) {
            queryParams.append('filters', JSON.stringify(cleanFilters));
          }
        }

        const url = queryParams.toString()
          ? `/orders?${queryParams.toString()}`
          : '/orders';

        const response = await apiClient.get(url);

        if (response.data.success) {
          setOrders(response.data.orders || []);
        } else {
          setError(response.data.error || 'Failed to fetch orders');
        }
      } catch (err: any) {
        console.error('Error fetching orders:', err);
        setError(err.message || 'An error occurred while fetching orders');
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const refreshOrders = useCallback(async () => {
    await fetchOrders(lastFilters);
  }, [fetchOrders, lastFilters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    fetchOrders,
    refreshOrders,
  };
};
