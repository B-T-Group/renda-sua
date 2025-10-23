import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface DeliveryFeeResponse {
  success: boolean;
  deliveryFee: number;
  distance?: number;
  method: 'distance_based' | 'flat_fee';
  currency: string;
  message: string;
}

export const useDeliveryFee = (
  itemId: string | null,
  addressId?: string | null,
  requiresFastDelivery?: boolean
) => {
  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  useEffect(() => {
    const fetchDeliveryFee = async () => {
      if (!itemId || !apiClient) {
        setDeliveryFee(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (addressId) {
          params.append('addressId', addressId);
        }
        if (requiresFastDelivery) {
          params.append('requiresFastDelivery', 'true');
        }

        const queryString = params.toString();
        const url = `/orders/item/${itemId}/deliveryFee${
          queryString ? `?${queryString}` : ''
        }`;

        const response = await apiClient.get(url);

        if (response.data.success) {
          setDeliveryFee(response.data);
        } else {
          setError(response.data.message || 'Failed to fetch delivery fee');
        }
      } catch (err: any) {
        console.error('Error fetching delivery fee:', err);
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to fetch delivery fee'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryFee();
  }, [itemId, addressId, requiresFastDelivery, apiClient]);

  return {
    deliveryFee,
    loading,
    error,
    refetch: () => {
      if (itemId && apiClient) {
        setLoading(true);
        setError(null);
        // Trigger the useEffect by updating the dependency
        setDeliveryFee(null);
      }
    },
  };
};
