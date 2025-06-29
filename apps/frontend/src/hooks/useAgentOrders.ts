import { useEffect, useRef, useState, useCallback } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';
import { useApiClient } from './useApiClient';

const UPDATE_ORDER_STATUS = `
  mutation UpdateOrderStatus($id: uuid!, $current_status: order_status_enum!, $assigned_agent_id: uuid) {
    update_orders_by_pk(
      pk_columns: { id: $id }
      _set: { 
        current_status: $current_status
        assigned_agent_id: $assigned_agent_id
        updated_at: "now()"
      }
    ) {
      id
      current_status
      assigned_agent_id
      updated_at
    }
  }
`;

export interface OrderItem {
  id: string;
  item_name: string;
  item_description: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  weight?: number;
  weight_unit?: string;
  dimensions?: string;
  special_instructions?: string;
}

export interface Address {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface BusinessLocation {
  id: string;
  name: string;
  location_type: string;
  address: Address;
}

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

export interface Client {
  id: string;
  user: User;
}

export interface Business {
  id: string;
  name: string;
  user: User;
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
  client: Client;
  business: Business;
  business_location: BusinessLocation;
  delivery_address: Address;
  order_items: OrderItem[];
}

export interface ActiveOrdersResponse {
  success: boolean;
  orders: Order[];
  count: number;
}

export interface PendingOrdersResponse {
  success: boolean;
  orders: Order[];
  count: number;
}

export interface PickUpOrderResponse {
  success: boolean;
  order: {
    id: string;
    order_number: string;
    current_status: string;
    assigned_agent_id: string;
    updated_at: string;
  };
  message: string;
}

export const useAgentOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { execute: updateOrderStatus } = useGraphQLRequest(UPDATE_ORDER_STATUS);
  const apiClient = useApiClient();

  const fetchActiveOrders = useCallback(async () => {
    if (!apiClient) {
      setError('API client not available');
      return [];
    }

    try {
      const response = await apiClient.get<ActiveOrdersResponse>(
        '/agents/active_orders'
      );

      if (response.data.success) {
        setActiveOrders(response.data.orders);
        return response.data.orders;
      } else {
        setError('Failed to fetch active orders');
        setActiveOrders([]);
        return [];
      }
    } catch (err: any) {
      console.error('Error fetching active orders:', err);
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to fetch active orders'
      );
      setActiveOrders([]);
      return [];
    }
  }, [apiClient]);

  const fetchPendingOrders = useCallback(async () => {
    if (!apiClient) {
      setError('API client not available');
      return [];
    }

    try {
      const response = await apiClient.get<PendingOrdersResponse>(
        '/users/pending_orders'
      );

      if (response.data.success) {
        setPendingOrders(response.data.orders);
        return response.data.orders;
      } else {
        setError('Failed to fetch pending orders');
        return [];
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to fetch pending orders'
      );
      return [];
    }
  }, [apiClient]);

  const fetchAllOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await Promise.all([
        fetchActiveOrders(),
        fetchPendingOrders(),
      ]);
      console.log('result', result);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchActiveOrders, fetchPendingOrders]);

  useEffect(() => {
    setTimeout(() => {
      fetchAllOrders();
    }, 0);
  }, [fetchAllOrders]);

  // Combine active and pending orders for the main orders state
  useEffect(() => {
    setOrders([...activeOrders, ...pendingOrders]);
  }, [activeOrders, pendingOrders]);

  const pickUpOrder = useCallback(
    async (orderId: string) => {
      if (!apiClient) {
        throw new Error('API client not available');
      }

      try {
        const response = await apiClient.post<PickUpOrderResponse>(
          '/agents/pick_up_order',
          {
            order_id: orderId,
          }
        );

        if (response.data.success) {
          // Refresh both active and pending orders after successful pickup
          await fetchAllOrders();
          return response.data.order;
        } else {
          throw new Error(response.data.message || 'Failed to pick up order');
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.error ||
          error.message ||
          'Failed to pick up order';
        console.error('Error picking up order:', errorMessage);
        throw new Error(errorMessage);
      }
    },
    [apiClient, fetchAllOrders]
  );

  const updateOrderStatusAction = useCallback(
    async (orderId: string, status: string) => {
      try {
        await updateOrderStatus({
          id: orderId,
          current_status: status,
        });
        // Refresh active orders after status update
        await fetchActiveOrders();
      } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
      }
    },
    [updateOrderStatus, fetchActiveOrders]
  );

  return {
    orders,
    activeOrders,
    pendingOrders,
    loading,
    error,
    refetch: fetchAllOrders,
    pickUpOrder,
    updateOrderStatusAction,
  };
};
