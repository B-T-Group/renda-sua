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

export function useItemLikes(page = 1, limit = 20) {
  const apiClient = useApiClient();
  const [data, setData] = useState<PaginatedLikes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, [apiClient, page, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
