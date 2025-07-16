import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useBackendOrders } from './useBackendOrders';

export interface BusinessOrder {
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
  payment_method: string | null;
  payment_status: string | null;
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
}

export interface OrderFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  address?: string;
}

const GET_BUSINESS_ORDERS = `
  query GetBusinessOrders($filters: orders_bool_exp) {
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
      payment_method
      payment_status
      created_at
      updated_at
      client {
        id
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

export const useBusinessOrders = (businessId?: string) => {
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({});

  const apiClient = useApiClient();

  // Use backend order management APIs
  const {
    confirmOrder,
    startPreparing,
    completePreparation,
    cancelOrder,
    refundOrder,
  } = useBackendOrders();

  const buildFilters = useCallback(
    (filterParams: OrderFilters) => {
      const conditions: any[] = [];

      // Business filter
      if (businessId) {
        conditions.push({
          business_id: { _eq: businessId },
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

      // Address filter
      if (filterParams.address) {
        conditions.push({
          delivery_address: {
            address_line_1: { _ilike: `%${filterParams.address}%` },
          },
        });
      }

      // Search filter (order number, client name, etc.)
      if (filterParams.search) {
        conditions.push({
          _or: [
            {
              order_number: { _ilike: `%${filterParams.search}%` },
            },
            {
              client: {
                user: {
                  first_name: { _ilike: `%${filterParams.search}%` },
                },
              },
            },
            {
              client: {
                user: {
                  last_name: { _ilike: `%${filterParams.search}%` },
                },
              },
            },
          ],
        });
      }

      const finalFilter = conditions.length > 0 ? { _and: conditions } : {};
      console.log(
        'useBusinessOrders: Final filter:',
        JSON.stringify(finalFilter, null, 2)
      );
      return finalFilter;
    },
    [businessId]
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
          case 'confirmed':
            response = await confirmOrder({ orderId, notes });
            break;
          case 'preparing':
            response = await startPreparing({ orderId, notes });
            break;
          case 'ready_for_pickup':
            response = await completePreparation({ orderId, notes });
            break;
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
    [
      confirmOrder,
      startPreparing,
      completePreparation,
      cancelOrder,
      refundOrder,
    ]
  );

  // Function to refresh orders when needed
  const refreshOrders = useCallback(() => {
    fetchOrders(filters);
  }, [fetchOrders, filters]);

  useEffect(() => {
    if (businessId) {
      fetchOrders({});
    } else {
      setOrders([]);
    }
  }, [businessId, fetchOrders]);

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
