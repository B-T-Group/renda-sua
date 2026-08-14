export type AiImageCleanupJobStatus =
  | 'queued'
  | 'processing'
  | 'ready_for_review'
  | 'failed'
  | 'completed'
  | 'cancelled';

export type AiImageCleanupResultStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'accepted'
  | 'rejected'
  | 'failed';

export type AiImageCleanupConfidenceTier = 'high' | 'medium' | 'low';

export type AiImageCleanupJobMode = 'review_all' | 'auto_apply';

export type AiImageCleanupJobSource =
  | 'creation'
  | 'library'
  | 'item_detail'
  | 'variant'
  | 'rental'
  | 'admin_moderation';

export type ImageActiveVersion = 'original' | 'enhanced';

export interface AiImageCleanupResultRow {
  id: string;
  job_id: string;
  business_image_id: string | null;
  item_variant_image_id: string | null;
  rental_item_image_id?: string | null;
  original_image_url: string;
  original_s3_key: string | null;
  cleaned_image_url: string | null;
  cleaned_s3_key: string | null;
  status: AiImageCleanupResultStatus;
  error_message: string | null;
  retry_of_result_id: string | null;
  confidence_score?: number | null;
  confidence_tier?: AiImageCleanupConfidenceTier | null;
  confidence_signals?: Record<string, unknown> | null;
  changes?: string[] | null;
  applied_at?: string | null;
  reverted_at?: string | null;
  provider?: string | null;
  provider_model?: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AiImageCleanupJobRow {
  id: string;
  business_id: string;
  item_id: string | null;
  item_variant_id: string | null;
  requested_by_user_id: string | null;
  status: AiImageCleanupJobStatus;
  tokens_reserved: number;
  tokens_consumed: number;
  tokens_refunded: number;
  mode?: AiImageCleanupJobMode;
  source?: AiImageCleanupJobSource;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  results?: AiImageCleanupResultRow[];
  item?: { id: string; name: string } | null;
  item_variant?: { id: string; name: string } | null;
}

export type CleanupEligibleImage = {
  id: string;
  image_url: string;
  s3_key: string | null;
  content_hash?: string | null;
  source: 'item_image' | 'variant_image' | 'rental_image';
  width?: number | null;
  height?: number | null;
  validation_warnings?: unknown;
  validation_errors?: unknown;
  quality_score?: number | null;
};

export type VersionedImageRow = {
  id: string;
  image_url: string;
  s3_key: string | null;
  original_image_url: string | null;
  original_s3_key: string | null;
  enhanced_image_url: string | null;
  enhanced_s3_key: string | null;
  active_version: ImageActiveVersion;
  is_ai_cleaned: boolean;
  reverted_at: string | null;
  content_hash?: string | null;
  width?: number | null;
  height?: number | null;
  validation_warnings?: unknown;
  validation_errors?: unknown;
  quality_score?: number | null;
};
