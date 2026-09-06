export type RentalModerationQueueStatus =
  | 'pending'
  | 'rejected'
  | 'ai_reviewing'
  | 'all';

export type AiReviewAuditStatus =
  | 'approved'
  | 'rejected'
  | 'proposal'
  | 'failed'
  | 'all';

export interface AdminRentalModerationListingRow {
  id: string;
  moderation_status: string;
  created_at: string;
  base_price_per_hour: number | string;
  rental_item: {
    id: string;
    name: string;
    business: { name: string; user_id: string };
    rental_item_images?: Array<{ id: string; image_url: string; display_order: number }>;
  };
  business_location: { id: string; name: string };
}

export interface AdminRentalModerationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AdminRentalModerationQueueResult {
  listings: AdminRentalModerationListingRow[];
  pagination: AdminRentalModerationPagination;
}

export interface AdminAiReviewRow {
  id: string;
  listing_id: string;
  status: string;
  decision_reason: string | null;
  alignment_score: number | null;
  prompt_version: string;
  admin_feedback: string | null;
  admin_override_action: string | null;
  model_meta: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
  listing?: {
    id: string;
    moderation_status: string;
    rental_item: {
      id: string;
      name: string;
      description: string | null;
      business: { name: string; user_id: string };
    };
  };
}

export interface AdminAiReviewDetail extends AdminAiReviewRow {
  rubric?: Record<string, unknown> | null;
  input_snapshot?: Record<string, unknown> | null;
  raw_model_response?: Record<string, unknown> | null;
  proposed_title?: string | null;
  proposed_description?: string | null;
  rejection_fields?: string[];
  admin_feedback_notes?: string | null;
}

export interface AdminAiReviewsResult {
  reviews: AdminAiReviewRow[];
  pagination: AdminRentalModerationPagination;
}

export interface BusinessAiProposalPayload {
  listing: {
    id: string;
    moderation_status: string;
    rental_item: {
      id: string;
      name: string;
      description: string | null;
      rental_item_images: Array<{
        id: string;
        image_url: string;
        display_order: number;
      }>;
    };
  } | null;
  proposal: {
    id: string;
    decision_reason: string | null;
    proposed_title: string | null;
    proposed_description: string | null;
  } | null;
}
