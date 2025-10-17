import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useBackendOrders } from './useBackendOrders';

export interface ClientOrder {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  business_location_id: string;
  assigned_agent_id: string | null;
  delivery_address_id: string;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  current_status: string;
  estimated_delivery_time: string | null;
  actual_delivery_time: string | null;
  special_instructions: string | null;
  preferred_delivery_time: string | null;
  requires_fast_delivery: boolean;
  fast_delivery_fee: number;
  payment_method: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string;
  business: {
    id: string;
    name: string;
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
      address_line_2: string | null;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  delivery_address: {
    id: string;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  assigned_agent: {
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  } | null;
  order_items: Array<{
    id: string;
    item_name: string;
    item_description: string | null;
    unit_price: number;
    quantity: number;
    total_price: number;
    weight: number | null;
    weight_unit: string | null;
    dimensions: string | null;
    special_instructions: string | null;
  }>;
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
          email: string;
          first_name: string;
          last_name: string;
        };
      };
    };
  }>;
}

export interface OrderFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

const GET_CLIENT_ORDERS = `
  query GetClientOrders($filters: orders_bool_exp) {
    orders(where: $filters, order_by: { created_at: desc }) {
      id
      order_number
      client_id
      business_id
      business_location_id
      assigned_agent_id
      delivery_address_id
      subtotal
      delivery_fee
      tax_amount
      total_amount
      currency
      current_status
      estimated_delivery_time
      actual_delivery_time
      special_instructions
      preferred_delivery_time
      requires_fast_delivery
      fast_delivery_fee
      payment_method
      payment_status
      created_at
      updated_at
      business {
        id
        name
        user {
          id
          first_name
          last_name
          email
        }
      }
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
      delivery_address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
      }
      assigned_agent {
        id
        user {
          id
          first_name
          last_name
          email
        }
      }
      order_items {
        id
        item_name
        item_description
        unit_price
        quantity
        total_price
        weight
        weight_unit
        dimensions
        special_instructions
      }
    }
  }
`;

export const useClientOrders = (clientId?: string) => {
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({});

  const apiClient = useApiClient();

  // Use backend order management APIs for client actions
  const { cancelOrder, refundOrder } = useBackendOrders();

  const buildFilters = useCallback(
    (filterParams: OrderFilters) => {
      const conditions: any[] = [];

      // Client filter
      if (clientId) {
        conditions.push({
          client_id: { _eq: clientId },
        });
      }

      // Status filter
      if (filterParams.status && filterParams.status !== 'all') {
        conditions.push({
          current_status: { _eq: filterParams.status },
        });
      }

      // Date range filter
      if (filterParams.dateFrom || filterParams.dateTo) {
        const dateCondition: any = {};
        if (filterParams.dateFrom) {
          dateCondition._gte = filterParams.dateFrom;
        }
        if (filterParams.dateTo) {
          dateCondition._lte = filterParams.dateTo;
        }
        conditions.push({
          created_at: dateCondition,
        });
      }

      // Search filter (order number, business name, etc.)
      if (filterParams.search) {
        conditions.push({
          _or: [
            {
              order_number: { _ilike: `%${filterParams.search}%` },
            },
            {
              business: {
                name: { _ilike: `%${filterParams.search}%` },
              },
            },
          ],
        });
      }

      const finalFilter = conditions.length > 0 ? { _and: conditions } : {};
      console.log(
        'useClientOrders: Final filter:',
        JSON.stringify(finalFilter, null, 2)
      );
      return finalFilter;
    },
    [clientId]
  );

  const fetchOrders = useCallback(
    async (filterParams: OrderFilters = {}) => {
      setLoading(true);
      setError(null);
      try {
        const builtFilters = buildFilters(filterParams);
        if (!apiClient) throw new Error('API client not available');
        const response = await apiClient.get('/orders', {
          params: { filters: JSON.stringify(builtFilters) },
        });
        setOrders(response.data.orders || []);
        setFilters(filterParams);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    },
    [apiClient, buildFilters]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: string, notes?: string) => {
      try {
        let response;

        switch (newStatus) {
          case 'cancelled':
            response = await cancelOrder({ orderId, notes });
            break;
          case 'refunded':
            response = await refundOrder({ orderId, notes });
            break;
          default:
            throw new Error(`Unsupported status transition: ${newStatus}`);
        }

        if (response.success) {
          // Update local state instead of refetching
          setOrders((prevOrders) =>
            prevOrders.map((order) =>
              order.id === orderId
                ? {
                    ...order,
                    current_status: newStatus,
                    updated_at:
                      response.order.updated_at || new Date().toISOString(),
                  }
                : order
            )
          );
          return response.order;
        } else {
          throw new Error(response.message || 'Failed to update order status');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update order status'
        );
        throw err;
      }
    },
    [cancelOrder, refundOrder]
  );

  // Function to refresh orders when needed
  const refreshOrders = useCallback(() => {
    fetchOrders(filters);
  }, [fetchOrders, filters]);

  useEffect(() => {
    if (clientId) {
      fetchOrders({});
    } else {
      setOrders([]);
    }
  }, [clientId, fetchOrders]);

  return {
    orders,
    loading,
    error,
    filters,
    fetchOrders,
    updateOrderStatus,
    refreshOrders,
  };
};
