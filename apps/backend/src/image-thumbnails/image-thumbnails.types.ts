export type ThumbnailSourceType =
  | 'item_image'
  | 'rental_item_image'
  | 'item_variant_image';

export type ThumbnailStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'skipped';

export interface ThumbnailSourceRow {
  id: string;
  business_id?: string | null;
  image_url: string;
  s3_key: string | null;
  thumbnail: string | null;
  thumbnail_status: ThumbnailStatus;
  thumbnail_attempts: number;
}

export interface ImageUrlBundle {
  id: string;
  /** Resolved URL for display: thumbnail when ready, else original. */
  url: string;
  /** Original image URL — always the source of truth. */
  original: string;
  /** Generated thumbnail URL when ready, else null. */
  thumbnail: string | null;
  status: ThumbnailStatus;
}

export interface ThumbnailQueueMessage {
  eventType: 'image.thumbnail.requested';
  sourceType: ThumbnailSourceType;
  imageId: string;
  timestamp: string;
}

export const THUMBNAIL_TABLES: Record<ThumbnailSourceType, string> = {
  item_image: 'item_images',
  rental_item_image: 'rental_item_images',
  item_variant_image: 'item_variant_images',
};

/** Tables that carry a business_id column (used for the S3 key prefix). */
export const THUMBNAIL_TABLES_WITH_BUSINESS_ID: ThumbnailSourceType[] = [
  'item_image',
  'rental_item_image',
];

export const THUMBNAIL_MAX_ATTEMPTS = 5;
export const THUMBNAIL_MAX_EDGE_PX = 400;
export const THUMBNAIL_WEBP_QUALITY = 80;
export const THUMBNAIL_JPEG_QUALITY = 82;
export const THUMBNAIL_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const THUMBNAIL_MAX_SOURCE_PIXELS = 40_000_000;
