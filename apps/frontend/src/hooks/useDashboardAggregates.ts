import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface DashboardAggregates {
  ordersTotal: number;
  ordersByStatus: Record<string, number>;
  itemCount: number;
  locationCount: number;
  inventoryCount: number;
  pendingFailedDeliveriesCount: number;
  clientCount?: number;
  agentsVerified?: number;
  agentsUnverified?: number;
  businessesVerified?: number;
  businessesNotVerified?: number;
}

export function useDashboardAggregates(businessId: string | undefined) {
  const apiClient = useApiClient();
  const [data, setData] = useState<DashboardAggregates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAggregates = useCallback(async () => {
    if (!apiClient || !businessId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: DashboardAggregates;
      }>('/dashboard/aggregates');
      if (response.data.success && response.data.data) {
        setData(response.data.data);
      } else {
        setData(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, businessId]);

  useEffect(() => {
    fetchAggregates();
  }, [fetchAggregates]);

  return {
    aggregates: data,
    loading,
    error,
    refresh: fetchAggregates,
  };
}
