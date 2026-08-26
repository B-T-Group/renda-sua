import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type OrderRiskType =
  | 'pending_acceptance'
  | 'prep_overdue'
  | 'ready_unassigned'
  | 'pickup_uncollected'
  | 'pickup_overdue'
  | 'delivery_delayed';

export type OrderRiskSeverity = 'warning' | 'critical';

export type AdminOrderRiskLevel = 'none' | OrderRiskSeverity;

export type AdminOrderNextAction =
  | 'contact_business'
  | 'contact_agent'
  | 'redispatch'
  | 'contact_client'
  | 'none';

export type OrderContactRole = 'client' | 'business' | 'agent';

export interface AdminOrderContact {
  role: OrderContactRole;
  name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  can_message: boolean;
  can_email: boolean;
  can_sms: boolean;
}

export interface AdminOrderRiskIncident {
  id: string;
  risk_type: OrderRiskType;
  severity: OrderRiskSeverity;
  detected_at: string;
  last_seen_at: string;
  due_at: string | null;
  overdue_minutes: number;
  reason: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledged_note: string | null;
  notified_count: number;
  last_notified_at: string | null;
}

export interface AdminOrderTiming {
  created_at: string | null;
  updated_at: string | null;
  status_changed_at: string | null;
  acceptance_deadline_at: string | null;
  promised_ready_at: string | null;
  pickup_due_at: string | null;
  estimated_delivery_time: string | null;
  promised_fulfill_by: string | null;
  delivery_window_end: string | null;
}

export interface AdminOrderCapabilities {
  can_redispatch: boolean;
  can_message_client: boolean;
  can_message_business: boolean;
  can_message_agent: boolean;
  can_force_status: boolean;
}

export interface AdminOrderRow {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_method: string | null;
  total_amount: number | null;
  currency: string | null;
  pickup_state: string | null;
  risk_level: AdminOrderRiskLevel;
  risk_since: string | null;
  risk_type: OrderRiskType | null;
  risk_summary: string | null;
  risk_acknowledged: boolean;
  next_action: AdminOrderNextAction;
  risk_incidents: AdminOrderRiskIncident[];
  contacts: AdminOrderContact[];
  timing: AdminOrderTiming;
  capabilities: AdminOrderCapabilities;
  business_location: {
    id: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  delivery_address: {
    address_line_1: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

export interface AdminOrderDetail extends AdminOrderRow {
  timeline: Array<{
    id: string;
    event_type: string;
    actor_type: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  messages: Array<{
    id: string;
    message: string;
    created_at: string;
    sender_name: string | null;
    recipient_types: string[];
  }>;
  resolved_incidents: AdminOrderRiskIncident[];
}

export interface AdminOrderFilters {
  queue?: 'at_risk' | 'all';
  status?: string;
  severity?: string;
  risk_type?: string;
  fulfillment_method?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

export interface AdminOrdersResponse {
  orders: AdminOrderRow[];
  total: number;
  offset: number;
  limit: number;
  counts: {
    total: number;
    at_risk: number;
    critical: number;
    warning: number;
  };
}

function buildQuery(filters: AdminOrderFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (value === 'all' && key !== 'queue' && key !== 'status') return;
    params.append(key, String(value));
  });
  return params.toString();
}

export const useAdminOrders = (filters: AdminOrderFilters = {}) => {
  const apiClient = useApiClient();
  const [data, setData] = useState<AdminOrdersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const queryString = buildQuery(filters);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/admin/orders?${queryString}`);
      setData(response.data);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, queryString]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { data, isLoading, error, refetch: fetchOrders };
};

export const useAdminOrderDetail = (orderId?: string) => {
  const apiClient = useApiClient();
  const [data, setData] = useState<AdminOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/admin/orders/${orderId}`);
      setData(response.data);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, orderId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, isLoading, error, refetch: fetchDetail };
};

/** Wraps a mutation so every admin action shares the same pending handling. */
function useAdminOrderMutation<TArgs>(
  request: (
    apiClient: ReturnType<typeof useApiClient>,
    args: TArgs
  ) => Promise<{ data: unknown }>
) {
  const apiClient = useApiClient();
  const [isPending, setIsPending] = useState(false);

  const mutateAsync = useCallback(
    async (args: TArgs) => {
      setIsPending(true);
      try {
        const response = await request(apiClient, args);
        return response.data;
      } finally {
        setIsPending(false);
      }
    },
    [apiClient, request]
  );

  return { mutateAsync, isPending };
}

export const useUnassignRedispatch = () =>
  useAdminOrderMutation<{ orderId: string; reason?: string }>(
    (apiClient, { orderId, reason }) =>
      apiClient.post(`/admin/orders/${orderId}/unassign-redispatch`, { reason })
  );

export const useUpdateOrderStatus = () =>
  useAdminOrderMutation<{ orderId: string; status: string; reason: string }>(
    (apiClient, { orderId, status, reason }) =>
      apiClient.patch(`/admin/orders/${orderId}/status`, { status, reason })
  );

export const useAddAdminNote = () =>
  useAdminOrderMutation<{ orderId: string; note: string }>(
    (apiClient, { orderId, note }) =>
      apiClient.post(`/admin/orders/${orderId}/notes`, { note })
  );

export const useSendOrderMessage = () =>
  useAdminOrderMutation<{
    orderId: string;
    message: string;
    recipientType: OrderContactRole;
  }>((apiClient, { orderId, message, recipientType }) =>
    apiClient.post(`/admin/orders/${orderId}/contact/message`, {
      message,
      recipient_type: recipientType,
    })
  );

export const useSendOrderEmail = () =>
  useAdminOrderMutation<{
    orderId: string;
    subject: string;
    message: string;
    recipientType: OrderContactRole;
  }>((apiClient, { orderId, subject, message, recipientType }) =>
    apiClient.post(`/admin/orders/${orderId}/contact/email`, {
      subject,
      message,
      recipient_type: recipientType,
    })
  );

export const useSendOrderSms = () =>
  useAdminOrderMutation<{
    orderId: string;
    message: string;
    recipientType: OrderContactRole;
  }>((apiClient, { orderId, message, recipientType }) =>
    apiClient.post(`/admin/orders/${orderId}/contact/sms`, {
      message,
      recipient_type: recipientType,
    })
  );

export const useAcknowledgeRiskIncident = () =>
  useAdminOrderMutation<{
    incidentId: string;
    note?: string;
    resolve?: boolean;
  }>((apiClient, { incidentId, note, resolve }) =>
    apiClient.post(`/admin/orders/risk-incidents/${incidentId}/acknowledge`, {
      note,
      resolve,
    })
  );
