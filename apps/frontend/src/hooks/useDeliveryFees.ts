import { useCallback, useEffect, useState } from 'react';
import { useGraphQLClient } from './useGraphQLClient';

export interface DeliveryFee {
  id: string;
  conditions: Record<string, any>;
  fee: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export const useDeliveryFees = () => {
  const { getAuthenticatedClient } = useGraphQLClient();
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveryFees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const client = await getAuthenticatedClient();
      if (!client) {
        throw new Error('Failed to get authenticated client');
      }

      const query = `
        query GetDeliveryFees {
          delivery_fees(order_by: {currency: asc}) {
            id
            conditions
            fee
            currency
            created_at
            updated_at
          }
        }
      `;

      const response = await client.request<{ delivery_fees: DeliveryFee[] }>(
        query
      );
      setDeliveryFees(response.delivery_fees || []);
    } catch (err) {
      console.error('Error fetching delivery fees:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch delivery fees'
      );
    } finally {
      setLoading(false);
    }
  }, [getAuthenticatedClient]);

  useEffect(() => {
    fetchDeliveryFees();
  }, [fetchDeliveryFees]);

  const getDeliveryFeeForCurrency = useCallback(
    (currency: string): DeliveryFee | null => {
      return deliveryFees.find((fee) => fee.currency === currency) || null;
    },
    [deliveryFees]
  );

  return {
    deliveryFees,
    loading,
    error,
    refetch: fetchDeliveryFees,
    getDeliveryFeeForCurrency,
  };
};

export default useDeliveryFees;
