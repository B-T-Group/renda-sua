import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useBackendOrders } from './useBackendOrders';
import { useCurrentLocation } from './useCurrentLocation';
import { useDistanceMatrix } from './useDistanceMatrix';

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
  item?: any; // Add this line to support nested item details
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
  order_status_history?: Array<{
    id: string;
    order_id: string;
    status: string;
    previous_status: string | null;
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
  }>;
}

export interface OrdersResponse {
  success: boolean;
  orders: Order[];
  message?: string;
}

export interface PickUpOrderResponse {
  success: boolean;
  order: Order;
  message: string;
}

// Helper function to categorize orders by status
const categorizeOrders = <T extends Order>(orders: T[]) => {
  const categorized = {
    active: [] as T[],
    inProgress: [] as T[],
    completed: [] as T[],
    cancelled: [] as T[],
  };

  orders.forEach((order) => {
    switch (order.current_status) {
      case 'assigned_to_agent':
      case 'picked_up':
      case 'in_transit':
      case 'out_for_delivery':
        categorized.active.push(order);
        break;
      case 'delivered':
      case 'complete':
        categorized.completed.push(order);
        break;
      case 'cancelled':
      case 'failed':
      case 'refunded':
        categorized.cancelled.push(order);
        break;
      default:
        // Any other status goes to in progress
        categorized.inProgress.push(order);
        break;
    }
  });

  // Sort orders by creation date (newest first)
  Object.keys(categorized).forEach((key) => {
    categorized[key as keyof typeof categorized].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  return categorized;
};

export const useAgentOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersWithDistance, setOrdersWithDistance] = useState<
    (Order & {
      deliveryDistance: string;
      deliveryEstTime: string;
      businessDistance: string;
      businessEstTime: string;
    })[]
  >([]);
  const [categorizedOrders, setCategorizedOrders] = useState({
    active: [] as (Order & {
      deliveryDistance: string;
      deliveryEstTime: string;
      businessDistance: string;
      businessEstTime: string;
    })[],
    inProgress: [] as (Order & {
      deliveryDistance: string;
      deliveryEstTime: string;
      businessDistance: string;
      businessEstTime: string;
    })[],
    completed: [] as (Order & {
      deliveryDistance: string;
      deliveryEstTime: string;
      businessDistance: string;
      businessEstTime: string;
    })[],
    cancelled: [] as (Order & {
      deliveryDistance: string;
      deliveryEstTime: string;
      businessDistance: string;
      businessEstTime: string;
    })[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useApiClient();
  const {
    pickUpOrder: backendPickUpOrder,
    startTransit,
    outForDelivery,
    deliverOrder,
    failDelivery,
  } = useBackendOrders();

  // Get current location
  const { location: currentLocation, getCurrentLocation } = useCurrentLocation(
    10 * 60 * 1000
  );

  const fetchAllOrders = useCallback(async () => {
    if (!apiClient) {
      setError('API client not available');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<OrdersResponse>(
        '/agents/active_orders'
      );

      if (response.data.success) {
        const allOrders = response.data.orders;
        setOrders(allOrders);
        // Initially categorize without distance info - will be updated when distance calculation completes
        const categorized = categorizeOrders(allOrders);
        setCategorizedOrders(categorized as any);
        return allOrders;
      } else {
        setError('Failed to fetch orders');
        setOrders([]);
        setCategorizedOrders({
          active: [],
          inProgress: [],
          completed: [],
          cancelled: [],
        });
        return [];
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(
        err.response?.data?.error || err.message || 'Failed to fetch orders'
      );
      setOrders([]);
      setCategorizedOrders({
        active: [],
        inProgress: [],
        completed: [],
        cancelled: [],
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    setTimeout(() => {
      fetchAllOrders();
    }, 0);
  }, [fetchAllOrders]);

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
          // Refresh all orders after successful pickup
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
          // Refresh all orders after status update
          await fetchAllOrders();
          return response.order;
        } else {
          throw new Error(response.message || 'Failed to update order status');
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
      }
    },
    [startTransit, outForDelivery, deliverOrder, failDelivery, fetchAllOrders]
  );

  const dropOrder = useCallback(
    async (orderId: string) => {
      if (!apiClient) throw new Error('API client not available');
      const response = await apiClient.post('/orders/drop_order', { orderId });
      if (response.data.success) {
        await fetchAllOrders(); // Refresh orders after dropping
        return response.data.order;
      }
      throw new Error(response.data.error || 'Failed to drop order');
    },
    [apiClient, fetchAllOrders]
  );

  const getOrderForPickup = useCallback(
    async (orderId: string) => {
      if (!apiClient) throw new Error('API client not available');
      const response = await apiClient.post('/orders/claim_order', { orderId });
      if (response.data.success) {
        await fetchAllOrders(); // Refresh orders after claiming
        return response.data;
      }
      throw new Error(response.data.error || 'Failed to claim order');
    },
    [apiClient, fetchAllOrders]
  );

  const { fetchDistanceMatrix } = useDistanceMatrix();

  useEffect(() => {
    if (orders.length > 0) {
      (async () => {
        // Get current location if not already available
        let userLocation = currentLocation;
        if (!userLocation) {
          try {
            userLocation = await getCurrentLocation();
          } catch (error) {
            console.warn(error);
            // If we can't get current location, we'll still calculate distances between business and delivery addresses
          }
        }

        const deliveryAddressIds = orders.reduce((acc, order) => {
          if (!acc.includes(order.delivery_address_id)) {
            acc.push(order.delivery_address_id);
          }
          return acc;
        }, [] as string[]);

        const sourceAddressIds = orders.reduce((acc, order) => {
          if (!acc.includes(order.business_location.address.id)) {
            acc.push(order.business_location.address.id);
          }
          return acc;
        }, deliveryAddressIds);

        // Prepare distance matrix payload
        const distanceMatrixPayload: any = {
          destination_address_ids: sourceAddressIds,
        };

        // Use current location as origin if available
        if (userLocation) {
          distanceMatrixPayload.origin_address = userLocation.address;
        }

        const distanceMatrix = await fetchDistanceMatrix(distanceMatrixPayload);

        const ordersWithDistance = orders.map((order) => {
          const idx = distanceMatrix.destination_ids.indexOf(
            order.delivery_address_id
          );
          const sourceIdx = distanceMatrix.destination_ids.indexOf(
            order.business_location.address.id
          );

          return {
            ...order,
            deliveryDistance:
              idx !== -1
                ? distanceMatrix.rows[0].elements[idx].distance?.text
                : 'N/A',
            deliveryEstTime:
              idx !== -1
                ? distanceMatrix.rows[0].elements[idx].duration?.text
                : 'N/A',
            businessDistance:
              sourceIdx !== -1
                ? distanceMatrix.rows[0].elements[sourceIdx].distance?.text
                : 'N/A',
            businessEstTime:
              sourceIdx !== -1
                ? distanceMatrix.rows[0].elements[sourceIdx].duration?.text
                : 'N/A',
          };
        });

        setOrdersWithDistance(ordersWithDistance);

        // Update categorized orders with distance information
        const categorizedWithDistance = categorizeOrders(ordersWithDistance);
        setCategorizedOrders(categorizedWithDistance);
      })();
    }
  }, [orders, currentLocation]);

  return {
    orders,
    categorizedOrders,
    loading,
    error,
    refetch: fetchAllOrders,
    pickUpOrder,
    updateOrderStatusAction,
    getOrderForPickup,
    dropOrder,
  };
};
