import { useCallback, useState } from 'react';
import { api } from '@/services/apiClient';
import type { ReorderOrderResponse } from '@/types/reorder';

export function useReorderOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reorder = useCallback(async (orderId: string): Promise<ReorderOrderResponse> => {
    setLoading(true);
    setError(null);
    try {
      return await api.post<ReorderOrderResponse>(`/orders/${orderId}/reorder`);
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
