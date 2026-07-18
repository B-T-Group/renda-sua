DROP INDEX IF EXISTS public.idx_ai_image_cleanup_results_variant_image;

ALTER TABLE public.ai_image_cleanup_results
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_results_image_source_check;

ALTER TABLE public.ai_image_cleanup_results
  DROP COLUMN IF EXISTS item_variant_image_id;

-- Restore NOT NULL only if every row has a business_image_id
UPDATE public.ai_image_cleanup_results
SET business_image_id = business_image_id
WHERE business_image_id IS NOT NULL;

ALTER TABLE public.ai_image_cleanup_results
  ALTER COLUMN business_image_id SET NOT NULL;

DROP INDEX IF EXISTS public.idx_ai_image_cleanup_jobs_variant;

ALTER TABLE public.ai_image_cleanup_jobs
  DROP COLUMN IF EXISTS item_variant_id;

ALTER TABLE public.item_variant_images
  DROP COLUMN IF EXISTS is_ai_cleaned;