import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderData {
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
  requires_fast_delivery: boolean;
  fast_delivery_fee: number;
  payment_method: string;
  payment_status: string;
  verified_agent_delivery: boolean;
  created_at: string;
  updated_at: string;
  access_reason: string;
  client: {
    id: string;
    user_id: string;
    user: {
      id: string;
      identifier: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
  };
  business: {
    id: string;
    user_id: string;
    name: string;
    is_admin: boolean;
    user: {
      id: string;
      identifier: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
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
      latitude?: number;
      longitude?: number;
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
    latitude?: number;
    longitude?: number;
  };
  assigned_agent?: {
    id: string;
    user_id: string;
    is_verified: boolean;
    user: {
      id: string;
      identifier: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
    };
  };
  order_items: Array<{
    id: string;
    business_inventory_id: string;
    item_id: string;
    item_name: string;
    item_description?: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    weight?: number;
    weight_unit?: string;
    dimensions?: string;
    special_instructions?: string;
    item: {
      id: string;
      sku: string;
      name: string;
      description?: string;
      currency: string;
      model?: string;
      color?: string;
      weight?: number;
      weight_unit?: string;
      brand?: {
        id: string;
        name: string;
        description?: string;
      };
      item_sub_category: {
        id: string;
        name: string;
        description?: string;
        item_category: {
          id: string;
          name: string;
          description?: string;
        };
      };
      item_images: Array<{
        id: string;
        image_url: string;
        alt_text?: string;
        display_order: number;
      }>;
    };
  }>;
  order_status_history: Array<{
    id: string;
    order_id: string;
    status: string;
    previous_status?: string;
    notes?: string;
    changed_by_type: string;
    changed_by_user_id: string;
    created_at: string;
    changed_by_user: {
      id: string;
      identifier: string;
      first_name: string;
      last_name: string;
      email: string;
      agent?: {
        id: string;
        user: {
          first_name: string;
          last_name: string;
          email: string;
        };
      };
      business?: {
        id: string;
        name: string;
        user: {
          first_name: string;
          last_name: string;
          email: string;
        };
      };
      client?: {
        id: string;
        user: {
          first_name: string;
          last_name: string;
          email: string;
        };
      };
    };
  }>;
  order_holds: Array<{
    id: string;
    client_id: string;
    agent_id?: string;
    client_hold_amount: number;
    agent_hold_amount: number;
    delivery_fees: number;
    currency: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  delivery_time_windows: Array<{
    id: string;
    order_id: string;
    slot_id: string;
    preferred_date: string;
    time_slot_start: string;
    time_slot_end: string;
    is_confirmed?: boolean;
    special_instructions?: string;
    confirmed_at?: string;
    confirmed_by?: string;
    created_at?: string;
    updated_at?: string;
    slot: {
      id: string;
      slot_name?: string;
      slot_type?: string;
      start_time?: string;
      end_time?: string;
      is_active?: boolean;
    };
    confirmedByUser?: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  }>;
}

interface UseOrderByIdResult {
  order: OrderData | null;
  loading: boolean;
  error: string | null;
  fetchOrder: (orderId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export const useOrderById = (): UseOrderByIdResult => {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchOrder = useCallback(
    async (orderId: string) => {
      setLoading(true);
      setError(null);
      setLastOrderId(orderId);

      try {
        const response = await apiClient.get(`/orders/${orderId}`);

        if (response.data.success) {
          setOrder(response.data.order);
        } else {
          setError(response.data.error || 'Failed to fetch order');
        }
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(
          err.response?.data?.error ||
            err.message ||
            'An error occurred while fetching the order'
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const refetch = useCallback(async () => {
    if (lastOrderId) {
      await fetchOrder(lastOrderId);
    }
  }, [fetchOrder, lastOrderId]);

  return {
    order,
    loading,
    error,
    fetchOrder,
    refetch,
  };
};
