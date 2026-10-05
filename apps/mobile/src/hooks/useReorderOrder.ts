import { useCallback, useState } from 'react';
import { api } from '@/services/apiClient';
import type { ReorderOrderResponse } from '@/types/reorder';

export function useReorderOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorder = useCallback(async (
    orderId: string,
    foodOnly = false
  ): Promise<ReorderOrderResponse> => {
    setLoading(true);
    setError(null);
    const path = foodOnly
      ? `/orders/${orderId}/reorder?food_only=true`
      : `/orders/${orderId}/reorder`;
    try {
      return await api.post<ReorderOrderResponse>(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reorder, loading, error };
}
