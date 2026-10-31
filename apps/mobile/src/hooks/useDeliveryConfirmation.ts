import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { DeliveryConfirmationState } from '../types/deliveryConfirmation';
import { shouldFetchDeliveryConfirmation } from '../utils/deliveryConfirmationUi';

export function useDeliveryConfirmation(
  orderId: string | undefined,
  status?: string | null,
  fulfillmentMethod?: string | null
) {
  const enabled = !!orderId && shouldFetchDeliveryConfirmation(status, fulfillmentMethod);
  const [state, setState] = useState<DeliveryConfirmationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!orderId || !shouldFetchDeliveryConfirmation(status, fulfillmentMethod)) {
      setState(null);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await agentApi.orders.getDeliveryConfirmation(orderId);
      setState(next);
      return next;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load delivery confirmation');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fulfillmentMethod, orderId, status]);

  useEffect(() => {
    if (!enabled) {
      setState(null);
      return;
    }
    void refetch();
  }, [enabled, refetch]);

  return { state, loading, error, refetch, enabled };
}
