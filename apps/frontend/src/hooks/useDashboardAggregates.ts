import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useBusinessOrdersLiveRevision } from './useBusinessOrdersLive';

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

  const fetchAggregates = useCallback(async (silent = false) => {
    if (!apiClient || !businessId) {
      if (!silent) {
        setData(null);
        setLoading(false);
      }
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: DashboardAggregates;
      }>('/dashboard/aggregates');
      if (response.data.success && response.data.data) {
        setData(response.data.data);
      } else if (!silent) {
        setData(null);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load dashboard');
        setData(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [apiClient, businessId]);

  const liveRevision = useBusinessOrdersLiveRevision();
  const seenRevision = useRef(liveRevision);

  useEffect(() => {
    void fetchAggregates();
  }, [fetchAggregates]);

  useEffect(() => {
    if (liveRevision === seenRevision.current) return;
    seenRevision.current = liveRevision;
    void fetchAggregates(true);
  }, [fetchAggregates, liveRevision]);

  return {
    aggregates: data,
    loading,
    error,
    refresh: fetchAggregates,
  };
}
