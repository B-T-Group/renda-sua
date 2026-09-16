import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type ReelAiReviewAuditStatus =
  | 'all'
  | 'approved'
  | 'skipped'
  | 'deferred'
  | 'failed';

export type AdminReelAiReviewRow = {
  id: string;
  reel_id: string;
  status: string;
  decision_reason: string | null;
  prompt_version: string;
  admin_feedback: string | null;
  admin_override_action: string | null;
  created_at: string;
  completed_at: string | null;
  reel?: {
    id: string;
    caption: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
    moderation_status: string;
    business?: { id: string; name: string } | null;
  } | null;
};

export type AdminReelAiReviewDetail = AdminReelAiReviewRow & {
  raw_model_response?: unknown;
  input_snapshot?: unknown;
  admin_feedback_notes?: string | null;
};

export function useReelAiReviews() {
  const api = useApiClient();
  const [reviews, setReviews] = useState<AdminReelAiReviewRow[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    totalPages: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(
    async (status: ReelAiReviewAuditStatus, page: number, limit = 20) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{
          reviews: AdminReelAiReviewRow[];
          pagination: {
            page: number;
            totalPages: number;
            total: number;
          };
        }>('/admin/reels/ai-reviews', {
          params: { status, page, limit },
        });
        setReviews(res.data.reviews ?? []);
        setPagination(res.data.pagination ?? null);
      } catch (e: unknown) {
        setReviews([]);
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  const fetchReviewDetail = useCallback(
    async (id: string) => {
      const res = await api.get<AdminReelAiReviewDetail>(
        `/admin/reels/ai-reviews/${id}`
      );
      return res.data;
    },
    [api]
  );

  const submitFeedback = useCallback(
    async (id: string, feedback: 'agree' | 'disagree', notes?: string) => {
      await api.post(`/admin/reels/ai-reviews/${id}/feedback`, {
        feedback,
        notes,
      });
    },
    [api]
  );

  const overrideReview = useCallback(
    async (
      id: string,
      action: 'force_approve' | 'force_reject' | 'force_requeue',
      reason?: string
    ) => {
      await api.post(`/admin/reels/ai-reviews/${id}/override`, {
        action,
        reason,
      });
    },
    [api]
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
