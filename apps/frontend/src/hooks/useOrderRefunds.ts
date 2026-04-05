import { useCallback, useState } from 'react';
import { isOrderRefundRequestAllowed } from '../utils/orderRefundWindow';
import { useApiClient } from './useApiClient';

export type RefundRequestReason =
  | 'not_delivered'
  | 'wrong_item'
  | 'damaged'
  | 'quality_issue'
  | 'missing_parts'
  | 'other';

export interface CreateRefundRequestBody {
  reason: RefundRequestReason;
  clientNotes?: string;
}

export interface ApproveFullBody {
  inspectionAcknowledged: boolean;
  refundDeliveryFee?: boolean;
  businessNote?: string;
}

export interface ApprovePartialBody {
  amount: number;
  inspectionAcknowledged: boolean;
  businessNote?: string;
}

export interface RejectRefundBody {
  rejectionReason: string;
}

export interface ApproveReplaceBody {
  inspectionAcknowledged: boolean;
  businessNote?: string;
}

/** Whether the client may request a refund (same rules as backend). */
export function isWithinRefundWindow(
  completedAt: string | null | undefined
): boolean {
  return isOrderRefundRequestAllowed(completedAt);
}

export function useOrderRefunds() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRefundRequest = useCallback(
    async (orderId: string, body: CreateRefundRequestBody) => {
      if (!apiClient) {
        throw new Error('Not authenticated');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post(`/orders/${orderId}/refund-request`, body);
        return res.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to submit refund request';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const listRefundRequests = useCallback(async () => {
    if (!apiClient) {
      throw new Error('Not authenticated');
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/orders/refund-requests');
      return res.data;
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to load refund requests';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const getRefundRequest = useCallback(
    async (orderId: string) => {
      if (!apiClient) {
        throw new Error('Not authenticated');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/orders/${orderId}/refund-request`);
        return res.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to load refund request';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const approveFull = useCallback(
    async (orderId: string, body: ApproveFullBody) => {
      if (!apiClient) {
        throw new Error('Not authenticated');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post(
          `/orders/${orderId}/refund-request/approve-full`,
          body
        );
        return res.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to approve refund';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const approvePartial = useCallback(
    async (orderId: string, body: ApprovePartialBody) => {
      if (!apiClient) {
        throw new Error('Not authenticated');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post(
          `/orders/${orderId}/refund-request/approve-partial`,
          body
        );
        return res.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to approve partial refund';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const approveReplaceItem = useCallback(
    async (orderId: string, body: ApproveReplaceBody) => {
      if (!apiClient) {
        throw new Error('Not authenticated');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post(
          `/orders/${orderId}/refund-request/approve-replace-item`,
          body
        );
        return res.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to approve replacement';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const rejectRefund = useCallback(
    async (orderId: string, body: RejectRefundBody) => {
      if (!apiClient) {
        throw new Error('Not authenticated');
      }
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post(
          `/orders/${orderId}/refund-request/reject`,
          body
        );
        return res.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to reject refund';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return {
    loading,
    error,
    createRefundRequest,
    listRefundRequests,
    getRefundRequest,
    approveFull,
    approvePartial,
    approveReplaceItem,
    rejectRefund,
  };
}
