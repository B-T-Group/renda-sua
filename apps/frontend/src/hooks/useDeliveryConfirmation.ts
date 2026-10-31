import { useCallback, useEffect, useState } from 'react';
import type { DeliveryConfirmationState } from '../types/deliveryConfirmation';
import { shouldFetchDeliveryConfirmation } from '../utils/deliveryConfirmationUi';
import { useApiClient } from './useApiClient';

export function useDeliveryConfirmation(
  orderId: string | undefined,
  status?: string | null,
  fulfillmentMethod?: string | null
) {
  const apiClient = useApiClient();
  const enabled = !!orderId && shouldFetchDeliveryConfirmation(status, fulfillmentMethod);
  const [state, setState] = useState<DeliveryConfirmationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!apiClient || !orderId || !shouldFetchDeliveryConfirmation(status, fulfillmentMethod)) {
      setState(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<DeliveryConfirmationState>(
        `/orders/${orderId}/delivery-confirmation`
      );
      setState(res.data);
      return res.data;
    } catch (e: any) {
      setError(e?.message || 'Failed to load delivery confirmation');
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiClient, fulfillmentMethod, orderId, status]);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    void refetch();
  }, [enabled, refetch]);

  return { state, loading, error, refetch, enabled };
}
