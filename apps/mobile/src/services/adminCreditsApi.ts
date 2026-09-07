import { apiRequest } from './apiClient';
import type {
  CreditsEscalationRow,
  CreditsFeedbackOrderRow,
  CreditsQueuePage,
  CreditsSummaryResponse,
  OrderFeedbackCreditBody,
  ResolveEscalationCreditBody,
} from '../types/adminCredits';

export type CreditsQueryParams = {
  limit?: number;
  offset?: number;
  country?: string;
};

function pageParams(params?: CreditsQueryParams): string {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const parts = [`limit=${Number(limit)}`, `offset=${Number(offset)}`];
  if (params?.country) {
    parts.push(`country=${encodeURIComponent(params.country)}`);
  }
  return parts.join('&');
}

export async function fetchCreditsSummary(
  params?: CreditsQueryParams
): Promise<CreditsSummaryResponse> {
  return apiRequest<CreditsSummaryResponse>(
    `/admin/credits/summary?${pageParams(params)}`,
    { method: 'GET' }
  );
}

export async function fetchCreditsEscalations(
  params?: CreditsQueryParams
): Promise<CreditsQueuePage<CreditsEscalationRow>> {
  return apiRequest<CreditsQueuePage<CreditsEscalationRow>>(
    `/admin/credits/queues/escalations?${pageParams(params)}`,
    { method: 'GET' }
  );
}

export async function fetchCreditsCancelledQueue(
  params?: CreditsQueryParams
): Promise<CreditsQueuePage<CreditsFeedbackOrderRow>> {
  return apiRequest<CreditsQueuePage<CreditsFeedbackOrderRow>>(
    `/admin/credits/queues/cancelled?${pageParams(params)}`,
    { method: 'GET' }
  );
}

export async function fetchCreditsFirstOrderQueue(
  params?: CreditsQueryParams
): Promise<CreditsQueuePage<CreditsFeedbackOrderRow>> {
  return apiRequest<CreditsQueuePage<CreditsFeedbackOrderRow>>(
    `/admin/credits/queues/first-order?${pageParams(params)}`,
    { method: 'GET' }
  );
}

export async function resolveCreditsEscalation(
  incidentId: string,
  body: ResolveEscalationCreditBody
): Promise<unknown> {
  return apiRequest(`/admin/credits/escalations/${incidentId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitCancelledFeedback(
  orderId: string,
  body: OrderFeedbackCreditBody
): Promise<{ success: boolean; credit?: unknown; classification?: string }> {
  return apiRequest(`/admin/credits/orders/${orderId}/cancelled-feedback`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitFirstOrderFeedback(
  orderId: string,
  body: OrderFeedbackCreditBody
): Promise<{ success: boolean; credit?: unknown; classification?: string }> {
  return apiRequest(`/admin/credits/orders/${orderId}/first-order-feedback`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
