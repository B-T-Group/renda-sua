import { useState, useCallback } from 'react';
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

export const useBusinessOrders = () => {
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({});

  const { execute } = useGraphQLRequest(GET_BUSINESS_ORDERS);

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
    updateOrderStatusMutation
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
  const { execute: executeAssignOrder } =
    useGraphQLRequest(assignOrderMutation);

  const buildFilters = useCallback((filterParams: OrderFilters) => {
    const conditions: any[] = [];

    // Business filter (always filter by current business)
    conditions.push({
      business: {
        user: {
          identifier: { _eq: 'X-Hasura-User-Id' },
        },
      },
    });

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

    return conditions.length > 0 ? { _and: conditions } : {};
  }, []);

  const fetchOrders = useCallback(
    async (filterParams: OrderFilters = {}) => {
      setLoading(true);
      setError(null);

      try {
        const filters = buildFilters(filterParams);
        const result = await execute({ filters });
        setOrders(result.orders || []);
        setFilters(filterParams);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    },
    [execute, buildFilters]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: string) => {
      try {
        await executeUpdateStatus({ orderId, status: newStatus });

        // Refresh orders after status update
        await fetchOrders(filters);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to update order status'
        );
      }
    },
    [executeUpdateStatus, fetchOrders, filters]
  );

  const assignOrderToAgent = useCallback(
    async (orderId: string, agentId: string) => {
      try {
        await executeAssignOrder({ orderId, agentId });

        // Refresh orders after assignment
        await fetchOrders(filters);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to assign order to agent'
        );
      }
    },
    [executeAssignOrder, fetchOrders, filters]
  );

  return {
    orders,
    loading,
    error,
    filters,
    fetchOrders,
    updateOrderStatus,
    assignOrderToAgent,
  };
};
