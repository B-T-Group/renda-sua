ALTER TABLE public.ai_image_cleanup_results
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_results_image_source_chk;

ALTER TABLE public.ai_image_cleanup_results
  ADD CONSTRAINT ai_image_cleanup_results_image_source_check CHECK (
    (business_image_id IS NOT NULL AND item_variant_image_id IS NULL)
    OR (business_image_id IS NULL AND item_variant_image_id IS NOT NULL)
  );
