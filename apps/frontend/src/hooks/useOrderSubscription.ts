import { gql, useSubscription } from '@apollo/client';
import { useEffect, useRef } from 'react';

const ORDER_SUBSCRIPTION = gql`
  subscription OnOrderUpdate($orderId: uuid!) {
    orders_by_pk(id: $orderId) {
      id
      current_status
      updated_at
      assigned_agent_id
      order_status_history(
        order_by: [{ created_at: desc }]
        limit: 1
      ) {
        id
        status
        previous_status
        notes
        created_at
      }
    }
  }
`;

interface OrderSubscriptionData {
  orders_by_pk: {
    id: string;
    current_status: string;
    updated_at: string | null;
    assigned_agent_id: string | null;
    order_status_history: Array<{
      id: string;
      status: string;
      previous_status: string | null;
      notes: string | null;
      created_at: string;
    }>;
  } | null;
}

export interface UseOrderSubscriptionProps {
  orderId: string | null;
  onOrderUpdate?: () => void;
  enabled?: boolean;
}

/**
 * Subscribes to real-time updates for a single order (orders_by_pk).
 * When the order changes in Hasura, onOrderUpdate is called (e.g. to refetch from REST).
 */
export const useOrderSubscription = ({
  orderId,
  onOrderUpdate,
  enabled = true,
}: UseOrderSubscriptionProps) => {
  const onUpdateRef = useRef(onOrderUpdate);
  useEffect(() => {
    onUpdateRef.current = onOrderUpdate;
  }, [onOrderUpdate]);

  const { data, loading, error } = useSubscription<OrderSubscriptionData>(
    ORDER_SUBSCRIPTION,
    {
      variables: { orderId: orderId ?? '' },
      skip: !enabled || !orderId,
      onData: ({ data: subData }) => {
        if (subData?.data?.orders_by_pk && onUpdateRef.current) {
          onUpdateRef.current();
        }
      },
      onError: (err) => {
        console.warn('Order subscription error:', err);
      },
    }
  );

  return {
    orderSnapshot: data?.orders_by_pk ?? null,
    loading,
    error,
    isActive: Boolean(enabled && orderId && !error),
  };
};

export default useOrderSubscription;
