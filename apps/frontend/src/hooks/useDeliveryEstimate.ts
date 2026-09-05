import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

/**
 * Response shape from BE #196 GET /api/delivery/estimate
 */
export interface DeliveryEstimateResponse {
  areaLabel: string;
  needsFinerArea: boolean;
  window: {
    label: string;
    band: string;
    start: string | null;
    end: string | null;
  } | null;
  fee: {
    currency: string;
    min: number | null;
    max: number | null;
    exact: number | null;
    confidence: 'exact' | 'range' | 'unknown';
  } | null;
  servingStatus: string | null;
  coverage: 'in' | 'out';
  trustVariant: 'map_and_pin' | 'sms_link' | 'app_and_web' | null;
}

export interface DeliveryEstimateParams {
  marketId: string;
  areaId?: string | null;
  category: 'store' | 'food' | 'rental';
  sellerId?: string;
  skuId?: string;
  qty?: number;
}

export interface UseDeliveryEstimateResult {
  estimate: DeliveryEstimateResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch delivery estimate from BE #196.
 * 
 * Consumes GET /api/delivery/estimate?marketId&areaId&category&sellerId&skuId&qty
 * 
 * TODO: Once #196 merges, verify the actual endpoint path and response shape.
 * If endpoint is not ready, this will gracefully fail and return null estimate.
 */
export function useDeliveryEstimate(
  params: DeliveryEstimateParams | null
): UseDeliveryEstimateResult {
  const apiClient = useApiClient();
  const [estimate, setEstimate] = useState<DeliveryEstimateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = useCallback(async () => {
    if (!params) {
      setEstimate(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.set('marketId', params.marketId);
      if (params.areaId) queryParams.set('areaId', params.areaId);
      queryParams.set('category', params.category);
      if (params.sellerId) queryParams.set('sellerId', params.sellerId);
      if (params.skuId) queryParams.set('skuId', params.skuId);
      if (params.qty != null) queryParams.set('qty', String(params.qty));

      const response = await apiClient.get(`/delivery/estimate?${queryParams.toString()}`);

      if (response.data.success) {
        setEstimate(response.data.estimate);
      } else {
        throw new Error(response.data.error || 'Failed to fetch delivery estimate');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to fetch delivery estimate';
      setError(errorMessage);
      console.error('Failed to fetch delivery estimate:', err);
      // Gracefully return null estimate if endpoint not ready yet
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [params, apiClient]);

  useEffect(() => {
    void fetchEstimate();
  }, [fetchEstimate]);

  return {
    estimate,
    loading,
    error,
    refetch: fetchEstimate,
  };
}
