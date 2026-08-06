-- 20260803120000 renamed the constraint to *_chk but dropped the wrong name,
-- so the old *_check (business XOR variant only) stayed and rejects rental rows.
ALTER TABLE public.ai_image_cleanup_results
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_results_image_source_check;

ALTER TABLE public.ai_image_cleanup_results
  DROP CONSTRAINT IF EXISTS ai_image_cleanup_results_image_source_chk;

ALTER TABLE public.ai_image_cleanup_results
  ADD CONSTRAINT ai_image_cleanup_results_image_source_chk CHECK (
    (
      (business_image_id IS NOT NULL)::int
      + (item_variant_image_id IS NOT NULL)::int
      + (rental_item_image_id IS NOT NULL)::int
    ) = 1
  );
