import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import { getClient } from '../services/apolloClient';

const ORDER_AGENT_LOCATION_SUB = gql`
  subscription OrderAgentLocation($orderId: uuid!) {
    agent_locations(where: { agent: { orders: { id: { _eq: $orderId } } } }) {
      latitude
      longitude
      updated_at
    }
  }
`;

export interface LiveAgentLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

interface AgentLocationRow {
  latitude: number | string;
  longitude: number | string;
  updated_at: string;
}

interface SubscriptionData {
  agent_locations: AgentLocationRow[];
}

/**
 * Live agent position for an order via a Hasura subscription.
 * Scoped server-side by the `client` row permission (assigned agent on the
 * client's active-delivery order). Emits null until data arrives.
 */
export function useOrderAgentLocationSubscription(
  orderId: string | null | undefined,
  enabled = true
): { location: LiveAgentLocation | null; error: string | null } {
  const [location, setLocation] = useState<LiveAgentLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !orderId) {
      setLocation(null);
      return;
    }
    setError(null);

    const observable = getClient().subscribe<SubscriptionData>({
      query: ORDER_AGENT_LOCATION_SUB,
      variables: { orderId },
    });

    const subscription = observable.subscribe({
      next: ({ data }) => {
        const row = data?.agent_locations?.[0];
        if (!row) {
          setLocation(null);
          return;
        }
        setLocation({
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          updatedAt: row.updated_at,
        });
      },
      error: (err: unknown) => {
        setError(err instanceof Error ? err.message : 'Subscription error');
      },
    });

    return () => subscription.unsubscribe();
  }, [orderId, enabled]);

  return { location, error };
}
