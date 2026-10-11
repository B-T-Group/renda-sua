import { useCallback, useEffect, useState } from 'react';
import { InventoryItem } from './useInventoryItems';
import { useApiClient } from './useApiClient';

interface PaginatedLikes {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** `enabled=false` skips the request (the restock-alerts likes route replaces it). */
export function useItemLikes(page = 1, limit = 20, enabled = true) {
  const apiClient = useApiClient();
  const [data, setData] = useState<PaginatedLikes | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: PaginatedLikes;
      }>('/item-likes', { params: { page, limit } });
      setData(response.data.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load liked items');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, page, limit, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
