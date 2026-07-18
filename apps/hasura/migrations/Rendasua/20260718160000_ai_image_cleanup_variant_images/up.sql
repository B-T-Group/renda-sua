-- Extend async AI image cleanup to support item_variant_images

ALTER TABLE public.item_variant_images
  ADD COLUMN IF NOT EXISTS is_ai_cleaned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.item_variant_images.is_ai_cleaned IS
  'True when the displayed image was replaced after AI cleanup';

ALTER TABLE public.ai_image_cleanup_jobs
  ADD COLUMN IF NOT EXISTS item_variant_id uuid NULL
    REFERENCES public.item_variants(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_image_cleanup_jobs_variant
  ON public.ai_image_cleanup_jobs (item_variant_id)
  WHERE item_variant_id IS NOT NULL;

ALTER TABLE public.ai_image_cleanup_results
  ALTER COLUMN business_image_id DROP NOT NULL;

ALTER TABLE public.ai_image_cleanup_results
  ADD COLUMN IF NOT EXISTS item_variant_image_id uuid NULL
    REFERENCES public.item_variant_images(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE public.ai_image_cleanup_results
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_results_image_source_check;

ALTER TABLE public.ai_image_cleanup_results
  ADD CONSTRAINT ai_image_cleanup_results_image_source_check CHECK (
    (business_image_id IS NOT NULL AND item_variant_image_id IS NULL)
    OR (business_image_id IS NULL AND item_variant_image_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_ai_image_cleanup_results_variant_image
  ON public.ai_image_cleanup_results (item_variant_image_id)
  WHERE item_variant_image_id IS NOT NULL;
