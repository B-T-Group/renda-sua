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

export interface RefundTimelineEvent {
  id: string;
  event_type: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface RefundPaymentRow {
  id: string;
  destination: string;
  amount: number;
  currency: string;
  status: string;
  failure_reason?: string | null;
}

export interface RefundEvidenceRow {
  id: string;
  file_url: string;
  mime_type?: string | null;
}

export interface RefundRequestDetail {
  id: string;
  status: string;
  reason: string;
  destination?: string | null;
  rejection_reason?: string | null;
  approved_amount?: number | null;
  return_status?: string | null;
  info_request_message?: string | null;
  timeline?: RefundTimelineEvent[];
  payments?: RefundPaymentRow[];
  evidence?: RefundEvidenceRow[];
}

export interface RefundRequestResponse {
  refundRequest: RefundRequestDetail | null;
  destination?: string;
  paymentSource?: string | null;
  timeline?: RefundTimelineEvent[];
  payments?: RefundPaymentRow[];
  evidence?: RefundEvidenceRow[];
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

  const requestReturn = useCallback(
    async (orderId: string, instructions?: string) => {
      if (!apiClient) throw new Error('Not authenticated');
      const res = await apiClient.post(`/orders/${orderId}/refund-request/request-return`, {
        instructions,
      });
      return res.data;
    },
    [apiClient]
  );

  const requestInfo = useCallback(
    async (orderId: string, message: string) => {
      if (!apiClient) throw new Error('Not authenticated');
      const res = await apiClient.post(`/orders/${orderId}/refund-request/request-info`, {
        message,
      });
      return res.data;
    },
    [apiClient]
  );

  const addEvidence = useCallback(
    async (orderId: string, fileUrl: string, mimeType?: string) => {
      if (!apiClient) throw new Error('Not authenticated');
      const res = await apiClient.post(`/orders/${orderId}/refund-request/evidence`, {
        fileUrl,
        mimeType,
      });
      return res.data;
    },
    [apiClient]
  );

  const respondToInfo = useCallback(
    async (orderId: string, message: string) => {
      if (!apiClient) throw new Error('Not authenticated');
      const res = await apiClient.post(`/orders/${orderId}/refund-request/messages`, {
        message,
      });
      return res.data;
    },
    [apiClient]
  );

  const getPendingCount = useCallback(async () => {
    if (!apiClient) return 0;
    const res = await apiClient.get('/orders/refund-requests/count');
    return res.data?.count ?? 0;
  }, [apiClient]);

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
    requestReturn,
    requestInfo,
    addEvidence,
    respondToInfo,
    getPendingCount,
  };
}
