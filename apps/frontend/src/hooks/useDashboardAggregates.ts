import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface TopViewedProduct {
  inventoryItemId: string;
  itemId: string;
  itemName: string;
  imageUrl: string | null;
  viewsCount: number;
}

export interface DashboardAggregates {
  ordersTotal: number;
  ordersByStatus: Record<string, number>;
  pendingCashReconciliationCount: number;
  itemCount: number;
  rentalItemCount: number;
  locationCount: number;
  inventoryCount: number;
  pendingFailedDeliveriesCount: number;
  /** Distinct clients who ordered or rented from this business. */
  uniqueClientCount: number;
  totalProductViews: number;
  productViewsLast7d: number;
  topViewedProducts: TopViewedProduct[];
  clientCount?: number;
  agentsVerified?: number;
  agentsUnverified?: number;
  businessesVerified?: number;
  businessesNotVerified?: number;
  approvedItemCount?: number;
  approvedRentalCount?: number;
  hasLogo?: boolean;
  hasOperatingHours?: boolean;
  lastCatalogItemAt?: string | null;
  itemsNeedingAiCleanupCount?: number;
  pendingItemCount?: number;
  rejectedItemCount?: number;
  topViewedOutOfStockCount?: number;
  tipsRemindersEnabled?: boolean;
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
