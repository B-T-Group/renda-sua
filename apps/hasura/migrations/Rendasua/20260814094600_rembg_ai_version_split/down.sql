-- Revert rembg/AI version split (enum values cannot be removed safely)

DROP INDEX IF EXISTS idx_rental_item_images_rembg_content_hash;
DROP INDEX IF EXISTS idx_item_images_rembg_content_hash;
DROP INDEX IF EXISTS idx_ai_image_cleanup_results_rental_kind_open;
DROP INDEX IF EXISTS idx_ai_image_cleanup_results_variant_kind_open;
DROP INDEX IF EXISTS idx_ai_image_cleanup_results_image_kind_open;

ALTER TABLE public.rental_item_images
  DROP COLUMN IF EXISTS rembg_image_url,
  DROP COLUMN IF EXISTS rembg_s3_key,
  DROP COLUMN IF EXISTS rembg_at,
  DROP COLUMN IF EXISTS is_rembg_cleaned;

ALTER TABLE public.item_variant_images
  DROP COLUMN IF EXISTS rembg_image_url,
  DROP COLUMN IF EXISTS rembg_s3_key,
  DROP COLUMN IF EXISTS rembg_at,
  DROP COLUMN IF EXISTS is_rembg_cleaned;

ALTER TABLE public.item_images
  DROP COLUMN IF EXISTS rembg_image_url,
  DROP COLUMN IF EXISTS rembg_s3_key,
  DROP COLUMN IF EXISTS rembg_at,
  DROP COLUMN IF EXISTS is_rembg_cleaned;

-- Flip any rembg live pointers back to original before dropping kind usage
UPDATE public.item_images
SET
  image_url = COALESCE(original_image_url, image_url),
  s3_key = COALESCE(original_s3_key, s3_key),
  active_version = 'original'
WHERE active_version::text = 'rembg';

UPDATE public.item_variant_images
SET
  image_url = COALESCE(original_image_url, image_url),
  s3_key = COALESCE(original_s3_key, s3_key),
  active_version = 'original'
WHERE active_version::text = 'rembg';

UPDATE public.rental_item_images
SET
  image_url = COALESCE(original_image_url, image_url),
  s3_key = COALESCE(original_s3_key, s3_key),
  active_version = 'original'
WHERE active_version::text = 'rembg';

ALTER TABLE public.ai_image_cleanup_results
  DROP COLUMN IF EXISTS kind;

DROP TYPE IF EXISTS public.ai_image_cleanup_kind;

-- Postgres cannot remove enum values safely; leave 'rembg' on image_active_version.
SELECT 1;
