import { useEffect, useRef, useState } from 'react';
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

export interface PendingOrdersResponse {
  success: boolean;
  orders: Order[];
  count: number;
}

export const useAgentOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { execute: updateOrderStatus } = useGraphQLRequest(UPDATE_ORDER_STATUS);
  const apiClient = useApiClient();

  const hasExecuted = useRef(false);

  const fetchPendingOrders = async () => {
    if (!apiClient) {
      setError('API client not available');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<PendingOrdersResponse>(
        '/users/pending_orders'
      );

      if (response.data.success) {
        setOrders(response.data.orders);
      } else {
        setError('Failed to fetch pending orders');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to fetch pending orders'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasExecuted.current) {
      hasExecuted.current = true;
      setTimeout(() => {
        fetchPendingOrders();
      }, 0);
    }
  }, [apiClient]);

  // Filter orders by status
  const activeOrders = orders.filter((order) =>
    ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(
      order.current_status
    )
  );

  const pendingOrders = orders.filter(
    (order) => order.current_status === 'pending'
  );

  const pickUpOrder = async (orderId: string, agentId: string) => {
    try {
      await updateOrderStatus({
        id: orderId,
        current_status: 'assigned',
        assigned_agent_id: agentId,
      });
      fetchPendingOrders(); // Refresh the orders
    } catch (error) {
      console.error('Error picking up order:', error);
      throw error;
    }
  };

  const updateOrderStatusAction = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus({
        id: orderId,
        current_status: status,
      });
      fetchPendingOrders(); // Refresh the orders
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  };

  return {
    orders,
    activeOrders,
    pendingOrders,
    loading,
    error,
    refetch: fetchPendingOrders,
    pickUpOrder,
    updateOrderStatusAction,
  };
};
