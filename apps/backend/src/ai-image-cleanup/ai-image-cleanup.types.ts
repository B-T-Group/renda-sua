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

export interface AiImageCleanupResultRow {
  id: string;
  job_id: string;
  business_image_id: string | null;
  item_variant_image_id: string | null;
  original_image_url: string;
  original_s3_key: string | null;
  cleaned_image_url: string | null;
  cleaned_s3_key: string | null;
  status: AiImageCleanupResultStatus;
  error_message: string | null;
  retry_of_result_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AiImageCleanupJobRow {
  id: string;
  business_id: string;
  item_id: string;
  item_variant_id: string | null;
  requested_by_user_id: string | null;
  status: AiImageCleanupJobStatus;
  tokens_reserved: number;
  tokens_consumed: number;
  tokens_refunded: number;
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
  source: 'item_image' | 'variant_image';
};
