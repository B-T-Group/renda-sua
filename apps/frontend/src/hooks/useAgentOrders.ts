import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useBackendOrders } from './useBackendOrders';

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

export interface Client {
  id: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface Business {
  id: string;
  name: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface BusinessLocation {
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
}

export interface Address {
  id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
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
  message?: string;
}

export interface PendingOrdersResponse {
  success: boolean;
  orders: Order[];
  message?: string;
}

export interface PickUpOrderResponse {
  success: boolean;
  order: Order;
  message: string;
}

export const useAgentOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useApiClient();
  const {
    getOrder,
    pickUpOrder: backendPickUpOrder,
    startTransit,
    outForDelivery,
    deliverOrder,
    failDelivery,
  } = useBackendOrders();

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
        const response = await backendPickUpOrder({
          orderId,
        });

        if (response.success) {
          // Refresh both active and pending orders after successful pickup
          await fetchAllOrders();
          return response.order;
        } else {
          throw new Error(response.message || 'Failed to pick up order');
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
    [apiClient, backendPickUpOrder, fetchAllOrders]
  );

  const updateOrderStatusAction = useCallback(
    async (orderId: string, status: string, notes?: string) => {
      try {
        let response;

        switch (status) {
          case 'in_transit':
            response = await startTransit({ orderId, notes });
            break;
          case 'out_for_delivery':
            response = await outForDelivery({ orderId, notes });
            break;
          case 'delivered':
            response = await deliverOrder({ orderId, notes });
            break;
          case 'failed':
            response = await failDelivery({ orderId, notes });
            break;
          default:
            throw new Error(`Unsupported status transition: ${status}`);
        }

        if (response.success) {
          // Refresh active orders after status update
          await fetchActiveOrders();
          return response.order;
        } else {
          throw new Error(response.message || 'Failed to update order status');
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
      }
    },
    [
      startTransit,
      outForDelivery,
      deliverOrder,
      failDelivery,
      fetchActiveOrders,
    ]
  );

  const getOrderForPickup = useCallback(
    async (orderId: string) => {
      try {
        const response = await getOrder({ orderId });

        if (response.success) {
          // Refresh orders after successful pickup
          await fetchAllOrders();
          return response;
        } else {
          throw new Error(response.message || 'Failed to get order');
        }
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.error || error.message || 'Failed to get order';
        console.error('Error getting order:', errorMessage);
        throw new Error(errorMessage);
      }
    },
    [getOrder, fetchAllOrders]
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
    getOrderForPickup,
  };
};
