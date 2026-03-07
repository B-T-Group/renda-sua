import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { InventoryItem } from './useInventoryItem';

export function useSimilarItems(inventoryItemId: string | null) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchSimilar = useCallback(
    async (id: string, limit = 12) => {
      if (!apiClient) return;
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: InventoryItem[];
        }>(`/inventory-items/${id}/similar`, { params: { limit } });
        if (response.data.success && Array.isArray(response.data.data)) {
          setItems(response.data.data);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch similar items'
        );
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    if (inventoryItemId) {
      fetchSimilar(inventoryItemId);
    } else {
      setItems([]);
    }
  }, [inventoryItemId, fetchSimilar]);

  return { items, loading, error, refetch: fetchSimilar };
}
