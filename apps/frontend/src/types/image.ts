// Define the possible image types based on the database enum
// ('thumbnail' was removed as a role — generated thumbnails live in the `thumbnail` column)
export type ImageType = 'main' | 'detail' | 'gallery' | 'angle';

export type ThumbnailStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface ItemImage {
  id: string;
  item_id?: string;
  image_url: string;
  image_type: ImageType;
  alt_text?: string;
  caption?: string;
  display_order?: number;
  uploaded_by?: string;
  is_ai_cleaned?: boolean;
  thumbnail?: string | null;
  thumbnail_status?: ThumbnailStatus;
  display_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateItemImageData {
  business_id: string;
  item_id: string;
  image_url: string;
  image_type: ImageType;
  alt_text?: string;
  caption?: string;
  display_order: number;
  uploaded_by: string;
  quality_score?: number | null;
  perceptual_hash?: string | null;
  validation_errors?: unknown[] | null;
  validation_warnings?: unknown[] | null;
  validated_at?: string | null;
}
