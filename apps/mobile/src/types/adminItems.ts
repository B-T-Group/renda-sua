export type ItemModerationQueueStatus =
  | 'pending'
  | 'rejected'
  | 'ai_reviewing'
  | 'proposal_pending'
  | 'all';

export type ItemAiReviewAuditStatus =
  | 'approved'
  | 'rejected'
  | 'proposal'
  | 'failed'
  | 'all';

export interface AdminItemModerationAiReviewSummary {
  id: string;
  status: string;
  decision_reason: string | null;
  rejection_fields?: string[] | null;
  created_at: string;
}

export interface AdminItemModerationRow {
  id: string;
  name: string;
  description: string | null;
  moderation_status: string;
  moderation_source?: string | null;
  moderated_at?: string | null;
  created_at: string;
  price: number | string | null;
  currency: string | null;
  is_active: boolean;
  business: { id: string; name: string; user_id: string };
  item_images?: Array<{ id: string; image_url: string; display_order: number }>;
  latest_ai_review?: AdminItemModerationAiReviewSummary | null;
  rejection_reason?: string | null;
}

export interface AdminItemModerationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AdminItemModerationQueueResult {
  items: AdminItemModerationRow[];
  pagination: AdminItemModerationPagination;
}

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

export interface AdminItemAiReviewsResult {
  reviews: AdminItemAiReviewRow[];
  pagination: AdminItemModerationPagination;
}

export interface BusinessItemAiProposalPayload {
  item: {
    id: string;
    name: string;
    description: string | null;
    moderation_status: string;
    item_images: Array<{
      id: string;
      image_url: string;
      display_order: number;
    }>;
  } | null;
  proposal: {
    id: string;
    decision_reason: string | null;
    proposed_title: string | null;
    proposed_description: string | null;
  } | null;
}
