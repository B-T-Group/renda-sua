import { apiRequest } from './apiClient';
import type {
  AdminItemAiReviewDetail,
  AdminItemAiReviewsResult,
  AdminItemModerationQueueResult,
  BusinessItemAiProposalPayload,
  ItemAiReviewAuditStatus,
  ItemModerationQueueStatus,
} from '../types/adminItems';

export async function fetchItemModerationQueue(params: {
  status?: ItemModerationQueueStatus;
  page?: number;
  limit?: number;
}): Promise<AdminItemModerationQueueResult> {
  const search = new URLSearchParams();
  search.set('status', params.status ?? 'pending');
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  const res = await apiRequest<{
    success: boolean;
    items: AdminItemModerationQueueResult['items'];
    pagination: AdminItemModerationQueueResult['pagination'];
    error?: string;
  }>(`/admin/items/moderation?${search.toString()}`, { method: 'GET' });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load moderation queue');
  }
  return { items: res.items ?? [], pagination: res.pagination };
}

export async function approveSaleItem(itemId: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/items/${encodeURIComponent(itemId)}/approve`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export async function rejectSaleItem(
  itemId: string,
  rejectionReason: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/items/${encodeURIComponent(itemId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    }
  );
  return !!res.success;
}

export async function messageBusinessAboutItem(
  itemId: string,
  params: { body: string; subject?: string }
): Promise<{ threadId: string; messageId: string }> {
  const res = await apiRequest<{
    success: boolean;
    data?: { threadId: string; messageId: string };
    error?: string;
  }>(`/admin/items/${encodeURIComponent(itemId)}/message`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Failed to message business');
  }
  return res.data;
}

export async function fetchItemAiReviews(params: {
  status?: ItemAiReviewAuditStatus;
  adminFeedback?: string;
  promptVersion?: string;
  page?: number;
  limit?: number;
}): Promise<AdminItemAiReviewsResult> {
  const search = new URLSearchParams();
  search.set('status', params.status ?? 'all');
  if (params.adminFeedback) search.set('adminFeedback', params.adminFeedback);
  if (params.promptVersion) search.set('promptVersion', params.promptVersion);
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  const res = await apiRequest<{
    success: boolean;
    reviews: AdminItemAiReviewsResult['reviews'];
    pagination: AdminItemAiReviewsResult['pagination'];
    error?: string;
  }>(`/admin/items/ai-reviews?${search.toString()}`, { method: 'GET' });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load AI reviews');
  }
  return { reviews: res.reviews ?? [], pagination: res.pagination };
}

export async function fetchItemAiReviewDetail(
  reviewId: string
): Promise<AdminItemAiReviewDetail> {
  const res = await apiRequest<{
    success: boolean;
    review: AdminItemAiReviewDetail;
    error?: string;
  }>(`/admin/items/ai-reviews/${encodeURIComponent(reviewId)}`, {
    method: 'GET',
  });
  if (!res.success || !res.review) {
    throw new Error(res.error || 'Failed to load AI review');
  }
  return res.review;
}

export async function submitItemAiReviewFeedback(
  reviewId: string,
  feedback: 'agree' | 'disagree',
  notes?: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/items/ai-reviews/${encodeURIComponent(reviewId)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({ feedback, notes }),
    }
  );
  return !!res.success;
}

export async function overrideItemAiReview(
  reviewId: string,
  action: 'force_approve' | 'force_reject' | 'force_requeue',
  reason?: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/items/ai-reviews/${encodeURIComponent(reviewId)}/override`,
    {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }
  );
  return !!res.success;
}

export async function fetchBusinessItemAiProposal(
  itemId: string
): Promise<BusinessItemAiProposalPayload> {
  const res = await apiRequest<{
    success: boolean;
    item: BusinessItemAiProposalPayload['item'];
    proposal: BusinessItemAiProposalPayload['proposal'];
    error?: string;
  }>(`/business-items/items/${encodeURIComponent(itemId)}/ai-proposal`, {
    method: 'GET',
  });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load AI proposal');
  }
  return { item: res.item, proposal: res.proposal };
}

export async function acceptBusinessItemAiProposal(
  itemId: string,
  edits?: {
    applyTitle?: boolean;
    applyDescription?: boolean;
    title?: string;
    description?: string;
  }
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/business-items/items/${encodeURIComponent(itemId)}/ai-proposal/accept`,
    { method: 'POST', body: JSON.stringify(edits ?? {}) }
  );
  return !!res.success;
}

export async function declineBusinessItemAiProposal(
  itemId: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/business-items/items/${encodeURIComponent(itemId)}/ai-proposal/decline`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export const adminItemsApi = {
  fetchItemModerationQueue,
  approveSaleItem,
  rejectSaleItem,
  messageBusinessAboutItem,
  fetchItemAiReviews,
  fetchItemAiReviewDetail,
  submitItemAiReviewFeedback,
  overrideItemAiReview,
  fetchBusinessItemAiProposal,
  acceptBusinessItemAiProposal,
  declineBusinessItemAiProposal,
};
