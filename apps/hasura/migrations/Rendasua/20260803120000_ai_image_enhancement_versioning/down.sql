ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS auto_enhance_enabled;

ALTER TABLE public.ai_image_cleanup_results
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_results_image_source_chk;

DROP INDEX IF EXISTS idx_ai_image_cleanup_results_rental_image;

ALTER TABLE public.ai_image_cleanup_results
  DROP COLUMN IF EXISTS rental_item_image_id;

DROP TRIGGER IF EXISTS trg_rental_item_images_ensure_original ON public.rental_item_images;
DROP TRIGGER IF EXISTS trg_item_variant_images_ensure_original ON public.item_variant_images;
DROP TRIGGER IF EXISTS trg_item_images_ensure_original ON public.item_images;
DROP FUNCTION IF EXISTS public.ensure_image_original_version();

ALTER TABLE public.ai_image_cleanup_jobs
  DROP COLUMN IF EXISTS mode,
  DROP COLUMN IF EXISTS source;

ALTER TABLE public.ai_image_cleanup_results
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS confidence_tier,
  DROP COLUMN IF EXISTS confidence_signals,
  DROP COLUMN IF EXISTS changes,
  DROP COLUMN IF EXISTS applied_at,
  DROP COLUMN IF EXISTS reverted_at,
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS provider_model;

ALTER TABLE public.rental_item_images
  DROP COLUMN IF EXISTS original_image_url,
  DROP COLUMN IF EXISTS original_s3_key,
  DROP COLUMN IF EXISTS enhanced_image_url,
  DROP COLUMN IF EXISTS enhanced_s3_key,
  DROP COLUMN IF EXISTS active_version,
  DROP COLUMN IF EXISTS enhanced_at,
  DROP COLUMN IF EXISTS reverted_at,
  DROP COLUMN IF EXISTS content_hash;

ALTER TABLE public.item_variant_images
  DROP COLUMN IF EXISTS original_image_url,
  DROP COLUMN IF EXISTS original_s3_key,
  DROP COLUMN IF EXISTS enhanced_image_url,
  DROP COLUMN IF EXISTS enhanced_s3_key,
  DROP COLUMN IF EXISTS active_version,
  DROP COLUMN IF EXISTS enhanced_at,
  DROP COLUMN IF EXISTS reverted_at,
  DROP COLUMN IF EXISTS content_hash;

ALTER TABLE public.item_images
  DROP COLUMN IF EXISTS original_image_url,
  DROP COLUMN IF EXISTS original_s3_key,
  DROP COLUMN IF EXISTS enhanced_image_url,
  DROP COLUMN IF EXISTS enhanced_s3_key,
  DROP COLUMN IF EXISTS active_version,
  DROP COLUMN IF EXISTS enhanced_at,
  DROP COLUMN IF EXISTS reverted_at,
  DROP COLUMN IF EXISTS content_hash;

DROP TYPE IF EXISTS public.ai_image_cleanup_job_source;
DROP TYPE IF EXISTS public.ai_image_cleanup_job_mode;
DROP TYPE IF EXISTS public.ai_image_cleanup_confidence_tier;
DROP TYPE IF EXISTS public.image_active_version;
