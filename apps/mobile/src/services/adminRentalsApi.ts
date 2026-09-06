import { apiRequest } from './apiClient';
import type {
  AdminAiReviewDetail,
  AdminAiReviewsResult,
  AdminRentalModerationQueueResult,
  AiReviewAuditStatus,
  BusinessAiProposalPayload,
  RentalModerationQueueStatus,
} from '../types/adminRentals';

export async function fetchRentalModerationQueue(params: {
  status?: RentalModerationQueueStatus;
  page?: number;
  limit?: number;
}): Promise<AdminRentalModerationQueueResult> {
  const search = new URLSearchParams();
  search.set('status', params.status ?? 'pending');
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  const res = await apiRequest<{
    success: boolean;
    listings: AdminRentalModerationQueueResult['listings'];
    pagination: AdminRentalModerationQueueResult['pagination'];
    error?: string;
  }>(`/admin/rental-listings/moderation?${search.toString()}`, {
    method: 'GET',
  });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load moderation queue');
  }
  return {
    listings: res.listings ?? [],
    pagination: res.pagination,
  };
}

export async function approveRentalListing(listingId: string): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/rental-listings/${encodeURIComponent(listingId)}/approve`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export async function rejectRentalListing(
  listingId: string,
  rejectionReason: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/rental-listings/${encodeURIComponent(listingId)}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    }
  );
  return !!res.success;
}

export async function fetchAiReviews(params: {
  status?: AiReviewAuditStatus;
  adminFeedback?: string;
  promptVersion?: string;
  page?: number;
  limit?: number;
}): Promise<AdminAiReviewsResult> {
  const search = new URLSearchParams();
  search.set('status', params.status ?? 'all');
  if (params.adminFeedback) search.set('adminFeedback', params.adminFeedback);
  if (params.promptVersion) search.set('promptVersion', params.promptVersion);
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  const res = await apiRequest<{
    success: boolean;
    reviews: AdminAiReviewsResult['reviews'];
    pagination: AdminAiReviewsResult['pagination'];
    error?: string;
  }>(`/admin/rental-listings/ai-reviews?${search.toString()}`, {
    method: 'GET',
  });
  if (!res.success) {
    throw new Error(res.error || 'Failed to load AI reviews');
  }
  return { reviews: res.reviews ?? [], pagination: res.pagination };
}

export async function fetchAiReviewDetail(
  reviewId: string
): Promise<AdminAiReviewDetail> {
  const res = await apiRequest<{
    success: boolean;
    review: AdminAiReviewDetail;
    error?: string;
  }>(`/admin/rental-listings/ai-reviews/${encodeURIComponent(reviewId)}`, {
    method: 'GET',
  });
  if (!res.success || !res.review) {
    throw new Error(res.error || 'Failed to load AI review');
  }
  return res.review;
}

export async function submitAiReviewFeedback(
  reviewId: string,
  feedback: 'agree' | 'disagree',
  notes?: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/rental-listings/ai-reviews/${encodeURIComponent(reviewId)}/feedback`,
    {
      method: 'POST',
      body: JSON.stringify({ feedback, notes }),
    }
  );
  return !!res.success;
}

export async function overrideAiReview(
  reviewId: string,
  action: 'force_approve' | 'force_reject' | 'force_requeue',
  reason?: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/admin/rental-listings/ai-reviews/${encodeURIComponent(reviewId)}/override`,
    {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    }
  );
  return !!res.success;
}

export async function fetchBusinessAiProposal(
  listingId: string
): Promise<BusinessAiProposalPayload> {
  const res = await apiRequest<{
    success: boolean;
    listing: BusinessAiProposalPayload['listing'];
    proposal: BusinessAiProposalPayload['proposal'];
    error?: string;
  }>(
    `/rentals/business/listings/${encodeURIComponent(listingId)}/ai-proposal`,
    { method: 'GET' }
  );
  if (!res.success) {
    throw new Error(res.error || 'Failed to load AI proposal');
  }
  return { listing: res.listing, proposal: res.proposal };
}

export async function acceptBusinessAiProposal(
  listingId: string,
  edits?: {
    applyTitle?: boolean;
    applyDescription?: boolean;
    title?: string;
    description?: string;
  }
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/rentals/business/listings/${encodeURIComponent(listingId)}/ai-proposal/accept`,
    { method: 'POST', body: JSON.stringify(edits ?? {}) }
  );
  return !!res.success;
}

export async function declineBusinessAiProposal(
  listingId: string
): Promise<boolean> {
  const res = await apiRequest<{ success: boolean; error?: string }>(
    `/rentals/business/listings/${encodeURIComponent(listingId)}/ai-proposal/decline`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  return !!res.success;
}

export const adminRentalsApi = {
  fetchRentalModerationQueue,
  approveRentalListing,
  rejectRentalListing,
  fetchAiReviews,
  fetchAiReviewDetail,
  submitAiReviewFeedback,
  overrideAiReview,
  fetchBusinessAiProposal,
  acceptBusinessAiProposal,
  declineBusinessAiProposal,
};
