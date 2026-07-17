DROP INDEX IF EXISTS public.idx_item_variant_images_thumbnail_status_pending;

ALTER TABLE public.item_variant_images
    DROP COLUMN IF EXISTS display_url,
    DROP COLUMN IF EXISTS thumbnail_error,
    DROP COLUMN IF EXISTS thumbnail_last_attempt_at,
    DROP COLUMN IF EXISTS thumbnail_attempts,
    DROP COLUMN IF EXISTS thumbnail_generated_at,
    DROP COLUMN IF EXISTS thumbnail_bytes,
    DROP COLUMN IF EXISTS thumbnail_format,
    DROP COLUMN IF EXISTS thumbnail_height,
    DROP COLUMN IF EXISTS thumbnail_width,
    DROP COLUMN IF EXISTS thumbnail_status,
    DROP COLUMN IF EXISTS thumbnail_s3_key,
    DROP COLUMN IF EXISTS thumbnail,
    DROP COLUMN IF EXISTS s3_key;
