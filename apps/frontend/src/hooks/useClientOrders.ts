import { useCallback, useEffect, useState } from 'react';
import { useBackendOrders } from './useBackendOrders';
import { useGraphQLRequest } from './useGraphQLRequest';

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

  const { execute } = useGraphQLRequest(GET_CLIENT_ORDERS, {
    loadingMessage: 'common.fetchingOrders',
  });

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
      console.log(
        'useClientOrders: Fetching orders with filters:',
        filterParams,
        'clientId:',
        clientId
      );
      setLoading(true);
      setError(null);

      try {
        const builtFilters = buildFilters(filterParams);
        console.log('useClientOrders: Built filters:', builtFilters);
        const result = await execute({ filters: builtFilters });
        console.log('useClientOrders: Fetch result:', result);
        console.log(
          'useClientOrders: Orders count:',
          result.orders?.length || 0
        );
        setOrders(result.orders || []);
        setFilters(filterParams);
      } catch (err) {
        console.error('useClientOrders: Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    },
    [execute, buildFilters, clientId]
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
    console.log('useClientOrders: clientId changed:', clientId);
    if (clientId) {
      console.log('useClientOrders: Fetching orders for client:', clientId);
      fetchOrders({});
    } else {
      console.log('useClientOrders: No clientId provided, clearing orders');
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
