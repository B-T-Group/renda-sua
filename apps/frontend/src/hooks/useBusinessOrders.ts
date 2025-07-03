import { useCallback, useEffect, useState } from 'react';
import { useGraphQLRequest } from './useGraphQLRequest';

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
  status?: string;
  address?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const GET_BUSINESS_ORDERS = `
  query GetBusinessOrders($filters: orders_bool_exp) {
    orders(
      where: $filters
      order_by: { created_at: desc }
    ) {
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

  const { execute } = useGraphQLRequest(GET_BUSINESS_ORDERS, {
    loadingMessage: 'common.fetchingOrders',
  });

  // Create mutation hooks at the top level
  const updateOrderStatusMutation = `
    mutation UpdateOrderStatus($orderId: uuid!, $status: order_status!) {
      update_orders_by_pk(
        pk_columns: { id: $orderId }
        _set: { current_status: $status, updated_at: "now()" }
      ) {
        id
        current_status
        updated_at
      }
    }
  `;
  const { execute: executeUpdateStatus } = useGraphQLRequest(
    updateOrderStatusMutation,
    { loadingMessage: 'common.updatingOrder' }
  );

  const assignOrderMutation = `
    mutation AssignOrderToAgent($orderId: uuid!, $agentId: uuid!) {
      update_orders_by_pk(
        pk_columns: { id: $orderId }
        _set: { 
          assigned_agent_id: $agentId, 
          current_status: "assigned_to_agent",
          updated_at: "now()" 
        }
      ) {
        id
        assigned_agent_id
        current_status
        updated_at
      }
    }
  `;
  const { execute: executeAssignOrder } = useGraphQLRequest(
    assignOrderMutation,
    { loadingMessage: 'common.updatingOrder' }
  );

  const buildFilters = useCallback(
    (filterParams: OrderFilters) => {
      const conditions: any[] = [];

      // Business ID filter - this is the key fix
      if (businessId) {
        console.log(
          'useBusinessOrders: Adding business_id filter:',
          businessId
        );
        conditions.push({
          business_id: { _eq: businessId },
        });
      } else {
        console.log(
          'useBusinessOrders: No businessId provided, will fetch all orders'
        );
      }

      // Status filter
      if (filterParams.status && filterParams.status !== 'all') {
        conditions.push({
          current_status: { _eq: filterParams.status },
        });
      }

      // Date range filter
      if (filterParams.dateFrom || filterParams.dateTo) {
        const dateFilter: any = {};
        if (filterParams.dateFrom) {
          dateFilter._gte = filterParams.dateFrom;
        }
        if (filterParams.dateTo) {
          dateFilter._lte = filterParams.dateTo;
        }
        conditions.push({
          created_at: dateFilter,
        });
      }

      // Address filter (search in delivery address)
      if (filterParams.address) {
        conditions.push({
          _or: [
            {
              delivery_address: {
                address_line_1: { _ilike: `%${filterParams.address}%` },
              },
            },
            {
              delivery_address: {
                city: { _ilike: `%${filterParams.address}%` },
              },
            },
            {
              delivery_address: {
                state: { _ilike: `%${filterParams.address}%` },
              },
            },
          ],
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
      console.log(
        'useBusinessOrders: Fetching orders with filters:',
        filterParams,
        'businessId:',
        businessId
      );
      setLoading(true);
      setError(null);

      try {
        const builtFilters = buildFilters(filterParams);
        console.log('useBusinessOrders: Built filters:', builtFilters);
        const result = await execute({ filters: builtFilters });
        console.log('useBusinessOrders: Fetch result:', result);
        console.log(
          'useBusinessOrders: Orders count:',
          result.orders?.length || 0
        );
        setOrders(result.orders || []);
        setFilters(filterParams);
      } catch (err) {
        console.error('useBusinessOrders: Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    },
    [execute, buildFilters, businessId]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      try {
        const result = await executeUpdateStatus({
          orderId,
          status: newStatus,
        });

        // Update local state instead of refetching
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  current_status: newStatus,
                  updated_at: result.update_orders_by_pk.updated_at,
                }
              : order
          )
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update order status'
        );
      }
    },
    [executeUpdateStatus]
  );

  const assignOrderToAgent = useCallback(
    async (orderId: string, agentId: string) => {
      try {
        const result = await executeAssignOrder({ orderId, agentId });

        // Update local state instead of refetching
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  assigned_agent_id: agentId,
                  current_status: 'assigned_to_agent',
                  updated_at: result.update_orders_by_pk.updated_at,
                }
              : order
          )
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to assign order to agent'
        );
      }
    },
    [executeAssignOrder]
  );

  // Function to refresh orders when needed
  const refreshOrders = useCallback(() => {
    fetchOrders(filters);
  }, [fetchOrders, filters]);

  useEffect(() => {
    console.log('useBusinessOrders: businessId changed:', businessId);
    if (businessId) {
      console.log(
        'useBusinessOrders: Fetching orders for business:',
        businessId
      );
      fetchOrders({});

      // Temporary debug: also fetch all orders to see if there are any orders at all
      setTimeout(async () => {
        try {
          console.log(
            'useBusinessOrders: Debug - fetching all orders to check if any exist'
          );
          const result = await execute({ filters: {} });
          console.log(
            'useBusinessOrders: Debug - all orders count:',
            result.orders?.length || 0
          );
          if (result.orders && result.orders.length > 0) {
            console.log(
              'useBusinessOrders: Debug - sample order business_id:',
              result.orders[0].business_id
            );
          }
        } catch (err) {
          console.error(
            'useBusinessOrders: Debug - error fetching all orders:',
            err
          );
        }
      }, 1000);
    } else {
      console.log('useBusinessOrders: No businessId provided, clearing orders');
      setOrders([]);
    }
  }, [businessId, fetchOrders, execute]);

  return {
    orders,
    loading,
    error,
    filters,
    fetchOrders,
    updateOrderStatus,
    assignOrderToAgent,
    refreshOrders,
  };
};
