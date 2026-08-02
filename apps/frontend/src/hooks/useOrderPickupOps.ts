import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderEventRow {
  id: string;
  order_id: string;
  event_type: string;
  actor_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export function useOrderPickupOps() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markPickupNotReady = useCallback(
    async (orderId: string, extraMinutes?: number) => {
      setLoading(true);
      setError(null);
      try {
        return await apiClient.post(`/orders/${orderId}/pickup-not-ready`, {
          extraMinutes,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to pause pickup monitoring');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const resumePickupMonitoring = useCallback(
    async (orderId: string) => {
      setLoading(true);
      setError(null);
      try {
        return await apiClient.post(`/orders/${orderId}/pickup-resume`);
      } catch (err: any) {
        setError(err?.message || 'Failed to resume pickup monitoring');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const fetchOrderEvents = useCallback(
    async (orderId: string): Promise<OrderEventRow[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<{
          success: boolean;
          events: OrderEventRow[];
        }>(`/orders/${orderId}/events`);
        return res.data?.events || [];
      } catch (err: any) {
        setError(err?.message || 'Failed to load order events');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return {
    markPickupNotReady,
    resumePickupMonitoring,
    fetchOrderEvents,
    loading,
    error,
  };
}
