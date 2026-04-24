import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ItemOrderStats {
  recentOrders30d: number;
  last7dViews: number;
}

export function useItemOrderStats(inventoryItemId: string | null) {
  const apiClient = useApiClient();
  const [stats, setStats] = useState<ItemOrderStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!apiClient || !inventoryItemId) {
      setStats(null);
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: ItemOrderStats;
      }>(`/inventory-items/${inventoryItemId}/order-stats`);
      if (res.data.success && res.data.data) {
        setStats(res.data.data);
      } else {
        setStats(null);
      }
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, inventoryItemId]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
