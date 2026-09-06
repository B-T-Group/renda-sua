import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { ItemDeliveryFeeResponse } from '../types/placeOrderPricing';

export interface CartBusinessFeeRow {
  businessId: string;
  sampleInventoryItemId: string;
}

export function useCartDeliveryFees(params: {
  rows: CartBusinessFeeRow[];
  addressId: string;
  enabled: boolean;
  requiresFastDelivery?: boolean;
}) {
  const { rows, addressId, enabled, requiresFastDelivery } = params;
  const [map, setMap] = useState<Map<string, ItemDeliveryFeeResponse | null>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !addressId || rows.length === 0) {
      setMap(new Map());
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const next = new Map<string, ItemDeliveryFeeResponse | null>();
    try {
      for (const r of rows) {
        try {
          const res = await agentApi.orders.getItemDeliveryFee(r.sampleInventoryItemId, {
            addressId,
            requiresFastDelivery,
          });
          next.set(r.businessId, res);
        } catch (e: unknown) {
          next.set(r.businessId, null);
          setError(e instanceof Error ? e.message : 'Delivery fee error');
        }
      }
      setMap(next);
    } finally {
      setLoading(false);
    }
  }, [addressId, enabled, requiresFastDelivery, rows]);

  useEffect(() => {
    void load();
  }, [load]);

  return { byBusiness: map, loading, error, refetch: load };
}
