import { useCallback, useState } from 'react';
import { api } from '@/services/apiClient';
import { isOrderRefundRequestAllowed } from '@/utils/orderRefundWindow';

export type RefundRequestReason =
  | 'not_delivered'
  | 'wrong_item'
  | 'damaged'
  | 'quality_issue'
  | 'missing_parts'
  | 'other';

export function isWithinRefundWindow(completedAt: string | null | undefined): boolean {
  return isOrderRefundRequestAllowed(completedAt);
}

export function useOrderRefunds() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRefundRequest = useCallback(
    async (orderId: string, body: { reason: RefundRequestReason; clientNotes?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post(`/orders/${orderId}/refund-request`, body);
        return res;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to submit refund request';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getRefundRequest = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      return await api.get(`/orders/${orderId}/refund-request`);
    } finally {
      setLoading(false);
    }
  }, []);

  const listRefundRequests = useCallback(async () => {
    return api.get('/orders/refund-requests');
  }, []);

  return {
    loading,
    error,
    createRefundRequest,
    getRefundRequest,
    listRefundRequests,
  };
}
