export const PROMPT_VERSION = 'item-ai-review-v1';

export type AiReviewDecision = 'approve' | 'propose' | 'reject';

export type AiReviewIssueField = 'title' | 'description' | 'images' | 'price';

export type AiImageActionType = 'keep' | 'cleanup' | 'replace_required';

export interface AiReviewIssue {
  field: AiReviewIssueField;
  code: string;
  message: string;
}

export interface AiImageAction {
  imageId: string;
  action: AiImageActionType;
  note?: string;
}

export interface AiReviewModelResult {
  decision: AiReviewDecision;
  reason: string;
  issues: AiReviewIssue[];
  proposedTitle: string | null;
  proposedDescription: string | null;
  imageActions: AiImageAction[];
  alignmentScore?: number;
  rubric?: Record<string, unknown>;
}

export interface ItemImageForReview {
  id: string;
  image_url: string;
  display_order: number;
  validation_errors?: unknown;
  quality_score?: number | null;
}

export interface ItemForAiReview {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  business_id: string;
  moderation_status: string;
  ai_review_version: number;
  is_active: boolean;
  business: { user_id: string; name: string };
  item_images: ItemImageForReview[];
}

export interface AiReviewRow {
  id: string;
  item_id: string;
  status: string;
  decision_reason: string | null;
  alignment_score: number | null;
  rubric: Record<string, unknown> | null;
  input_snapshot: Record<string, unknown> | null;
  raw_model_response: Record<string, unknown> | null;
  proposed_title: string | null;
  proposed_description: string | null;
  rejection_fields: string[];
  model_meta: Record<string, unknown> | null;
  prompt_version: string;
  review_version: number;
  admin_feedback: string | null;
  admin_feedback_notes: string | null;
  admin_override_action: string | null;
  created_at: string;
  completed_at: string | null;
  proposed_images?: Array<{
    id: string;
    source_image_id: string | null;
    image_url: string;
    s3_key: string | null;
    display_order: number;
  }>;
  item?: {
    id: string;
    name: string;
    description: string | null;
    moderation_status: string;
    business: { name: string; user_id: string };
  };
}
