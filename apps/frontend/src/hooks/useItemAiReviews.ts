import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type ItemAiReviewAuditStatus =
  | 'all'
  | 'approved'
  | 'rejected'
  | 'proposal'
  | 'failed';

export interface AdminItemAiReviewRow {
  id: string;
  item_id: string;
  status: string;
  decision_reason: string | null;
  alignment_score: number | null;
  prompt_version: string;
  admin_feedback: string | null;
  admin_override_action: string | null;
  model_meta: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
  item?: {
    id: string;
    name: string;
    description: string | null;
    moderation_status: string;
    business: { name: string; user_id: string };
  };
}

export interface AdminItemAiReviewDetail extends AdminItemAiReviewRow {
  rubric?: Record<string, unknown> | null;
  input_snapshot?: Record<string, unknown> | null;
  raw_model_response?: Record<string, unknown> | null;
  proposed_title?: string | null;
  proposed_description?: string | null;
  rejection_fields?: string[];
  admin_feedback_notes?: string | null;
}

export interface AdminItemAiReviewsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function useItemAiReviews() {
  const apiClient = useApiClient();
  const [reviews, setReviews] = useState<AdminItemAiReviewRow[]>([]);
  const [pagination, setPagination] =
    useState<AdminItemAiReviewsPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(
    async (status: ItemAiReviewAuditStatus, page: number, limit: number) => {
      if (!apiClient) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: String(limit),
        });
        const { data } = await apiClient.get<{
          success: boolean;
          reviews: AdminItemAiReviewRow[];
          pagination: AdminItemAiReviewsPagination;
          error?: string;
        }>(`/admin/items/ai-reviews?${params.toString()}`);
        if (!data.success) {
          throw new Error(data.error || 'Request failed');
        }
        setReviews(data.reviews ?? []);
        setPagination(data.pagination ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setReviews([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const fetchReviewDetail = useCallback(
    async (reviewId: string): Promise<AdminItemAiReviewDetail | null> => {
      if (!apiClient) return null;
      const { data } = await apiClient.get<{
        success: boolean;
        review: AdminItemAiReviewDetail;
      }>(`/admin/items/ai-reviews/${reviewId}`);
      return data.review ?? null;
    },
    [apiClient]
  );

  const submitFeedback = useCallback(
    async (
      reviewId: string,
      feedback: 'agree' | 'disagree',
      notes?: string
    ) => {
      if (!apiClient) return false;
      const { data } = await apiClient.post<{ success: boolean }>(
        `/admin/items/ai-reviews/${reviewId}/feedback`,
        { feedback, notes }
      );
      return !!data.success;
    },
    [apiClient]
  );

  const overrideReview = useCallback(
    async (
      reviewId: string,
      action: 'force_approve' | 'force_reject' | 'force_requeue',
      reason?: string
    ) => {
      if (!apiClient) return false;
      const { data } = await apiClient.post<{ success: boolean }>(
        `/admin/items/ai-reviews/${reviewId}/override`,
        { action, reason }
      );
      return !!data.success;
    },
    [apiClient]
  );

  return {
    reviews,
    pagination,
    loading,
    error,
    fetchReviews,
    fetchReviewDetail,
    submitFeedback,
    overrideReview,
  };
}
