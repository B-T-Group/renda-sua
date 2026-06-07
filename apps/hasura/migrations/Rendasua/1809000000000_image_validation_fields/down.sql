DROP INDEX IF EXISTS public.idx_rental_item_images_business_phash;
DROP INDEX IF EXISTS public.idx_item_images_business_phash;

ALTER TABLE public.rental_item_images
  DROP COLUMN IF EXISTS validated_at,
  DROP COLUMN IF EXISTS validation_warnings,
  DROP COLUMN IF EXISTS validation_errors,
  DROP COLUMN IF EXISTS perceptual_hash,
  DROP COLUMN IF EXISTS quality_score;

ALTER TABLE public.item_images
  DROP COLUMN IF EXISTS validated_at,
  DROP COLUMN IF EXISTS validation_warnings,
  DROP COLUMN IF EXISTS validation_errors,
  DROP COLUMN IF EXISTS perceptual_hash,
  DROP COLUMN IF EXISTS quality_score;
