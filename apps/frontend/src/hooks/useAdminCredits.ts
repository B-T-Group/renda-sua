import { useApiClient } from './useApiClient';
import { useCallback, useState } from 'react';

export type CreditEventType =
  | 'escalation_resolved'
  | 'business_referred'
  | 'agent_referred'
  | 'cancelled_feedback'
  | 'first_order_completed_feedback'
  | 'my_first_purchase';

export type CreditFeedbackAction =
  | 'called_client'
  | 'emailed_client'
  | 'spoke_in_person'
  | 'test_order'
  | 'internal_order';

export interface CreditsOrderItemBrief {
  item_name: string | null;
  quantity: number;
  variant_name: string | null;
}

export interface CreditsFeedbackOrderRow {
  id: string;
  order_number: string;
  current_status: string;
  cancelled_at?: string | null;
  completed_at?: string | null;
  cancellation_notes?: string | null;
  updated_at?: string | null;
  client?: {
    user_id?: string;
    user?: {
      first_name: string | null;
      last_name: string | null;
      phone_number: string | null;
      email?: string | null;
    } | null;
  } | null;
  business?: { name: string | null } | null;
  order_items?: CreditsOrderItemBrief[];
}

export interface CreditsSummaryRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  total_weight: number;
  credit_count: number;
  by_event: Record<string, { count: number; weight: number }>;
  is_agent: boolean;
  is_business: boolean;
}

export interface CreditsQueuePage<T> {
  items: T[];
  total: number;
}

export function useAdminCredits() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (params?: { limit?: number; offset?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const limit = params?.limit ?? 50;
        const offset = params?.offset ?? 0;
        const res = await apiClient.get(
          `/admin/credits/summary?limit=${limit}&offset=${offset}`
        );
        return res.data as {
          items: CreditsSummaryRow[];
          total: number;
          weights: Record<CreditEventType, number>;
        };
      } catch (err: any) {
        setError(err?.message || 'Failed to load summary');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const loadEscalations = useCallback(
    async (params?: { limit?: number; offset?: number }) => {
      const limit = params?.limit ?? 50;
      const offset = params?.offset ?? 0;
      const res = await apiClient.get(
        `/admin/credits/queues/escalations?limit=${limit}&offset=${offset}`
      );
      return res.data as CreditsQueuePage<any>;
    },
    [apiClient]
  );

  const loadCancelled = useCallback(
    async (params?: { limit?: number; offset?: number }) => {
      const limit = params?.limit ?? 50;
      const offset = params?.offset ?? 0;
      const res = await apiClient.get(
        `/admin/credits/queues/cancelled?limit=${limit}&offset=${offset}`
      );
      return res.data as CreditsQueuePage<CreditsFeedbackOrderRow>;
    },
    [apiClient]
  );

  const loadFirstOrder = useCallback(
    async (params?: { limit?: number; offset?: number }) => {
      const limit = params?.limit ?? 50;
      const offset = params?.offset ?? 0;
      const res = await apiClient.get(
        `/admin/credits/queues/first-order?limit=${limit}&offset=${offset}`
      );
      return res.data as CreditsQueuePage<CreditsFeedbackOrderRow>;
    },
    [apiClient]
  );

  const resolveEscalation = useCallback(
    async (
      incidentId: string,
      body: {
        contact_channel: string;
        order_result: string;
        notes: string;
      }
    ) => {
      const res = await apiClient.post(
        `/admin/credits/escalations/${incidentId}/resolve`,
        body
      );
      return res.data;
    },
    [apiClient]
  );

  const submitCancelledFeedback = useCallback(
    async (
      orderId: string,
      body: { notes: string; action: CreditFeedbackAction }
    ) => {
      const res = await apiClient.post(
        `/admin/credits/orders/${orderId}/cancelled-feedback`,
        body
      );
      return res.data;
    },
    [apiClient]
  );

  const submitFirstOrderFeedback = useCallback(
    async (
      orderId: string,
      body: { notes: string; action: CreditFeedbackAction }
    ) => {
      const res = await apiClient.post(
        `/admin/credits/orders/${orderId}/first-order-feedback`,
        body
      );
      return res.data;
    },
    [apiClient]
  );

  return {
    loading,
    error,
    loadSummary,
    loadEscalations,
    loadCancelled,
    loadFirstOrder,
    resolveEscalation,
    submitCancelledFeedback,
    submitFirstOrderFeedback,
  };
}
