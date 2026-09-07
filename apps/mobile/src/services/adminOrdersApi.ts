import { apiRequest } from './apiClient';
import type {
  AdminOrderDetail,
  AdminOrderQueue,
  AdminOrderRiskIncident,
  AdminOrdersListResult,
  OrderContactRole,
} from '../types/adminOrders';

export async function fetchAdminOrders(params: {
  queue?: AdminOrderQueue;
  status?: string;
  severity?: string;
  riskType?: string;
  search?: string;
  offset?: number;
  limit?: number;
}): Promise<AdminOrdersListResult> {
  const search = new URLSearchParams();
  search.set('queue', params.queue ?? 'at_risk');
  search.set('offset', String(params.offset ?? 0));
  search.set('limit', String(params.limit ?? 20));
  if (params.status) search.set('status', params.status);
  if (params.severity) search.set('severity', params.severity);
  if (params.riskType) search.set('risk_type', params.riskType);
  if (params.search?.trim()) search.set('search', params.search.trim());

  const res = await apiRequest<AdminOrdersListResult>(
    `/admin/orders?${search.toString()}`,
    { method: 'GET' }
  );
  return {
    orders: res.orders ?? [],
    total: res.total ?? 0,
    offset: res.offset ?? 0,
    limit: res.limit ?? 20,
    counts: res.counts ?? { total: 0, at_risk: 0, critical: 0, warning: 0 },
  };
}

export async function fetchAdminOrderDetail(
  orderId: string
): Promise<AdminOrderDetail> {
  return apiRequest<AdminOrderDetail>(`/admin/orders/${orderId}`, {
    method: 'GET',
  });
}

export async function sendAdminOrderMessage(
  orderId: string,
  recipientType: OrderContactRole,
  message: string
): Promise<void> {
  await apiRequest(`/admin/orders/${orderId}/contact/message`, {
    method: 'POST',
    body: JSON.stringify({ message, recipient_type: recipientType }),
  });
}

export async function sendAdminOrderSms(
  orderId: string,
  recipientType: OrderContactRole,
  message: string
): Promise<void> {
  await apiRequest(`/admin/orders/${orderId}/contact/sms`, {
    method: 'POST',
    body: JSON.stringify({ message, recipient_type: recipientType }),
  });
}

export async function unassignAndRedispatchOrder(
  orderId: string,
  reason?: string
): Promise<void> {
  await apiRequest(`/admin/orders/${orderId}/unassign-redispatch`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function addAdminOrderNote(
  orderId: string,
  note: string
): Promise<void> {
  await apiRequest(`/admin/orders/${orderId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function acknowledgeAdminRiskIncident(params: {
  incidentId: string;
  note?: string;
  resolve?: boolean;
  contact_channel?: string;
  order_result?: string;
}): Promise<AdminOrderRiskIncident | null> {
  const res = await apiRequest<{
    success: boolean;
    incident?: AdminOrderRiskIncident;
  }>(`/admin/orders/risk-incidents/${params.incidentId}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({
      note: params.note,
      resolve: params.resolve,
      contact_channel: params.contact_channel,
      order_result: params.order_result,
    }),
  });
  return res.incident ?? null;
}
