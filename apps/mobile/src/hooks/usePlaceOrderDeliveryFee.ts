import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { ItemDeliveryFeeResponse } from '../types/placeOrderPricing';

export function usePlaceOrderDeliveryFee(params: {
  itemId: string;
  addressId: string;
  enabled: boolean;
  requiresFastDelivery?: boolean;
}) {
  const [data, setData] = useState<ItemDeliveryFeeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { itemId, addressId, enabled, requiresFastDelivery } = params;

  const load = useCallback(async () => {
    if (!enabled || !itemId || !addressId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.orders.getItemDeliveryFee(itemId, {
        addressId,
        requiresFastDelivery,
      });
      setData(res);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Delivery fee error');
    } finally {
      setLoading(false);
    }
  }, [addressId, enabled, itemId, requiresFastDelivery]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
