ALTER TABLE public.item_images
  ADD COLUMN IF NOT EXISTS quality_score SMALLINT,
  ADD COLUMN IF NOT EXISTS perceptual_hash TEXT,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS validation_warnings JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

ALTER TABLE public.rental_item_images
  ADD COLUMN IF NOT EXISTS quality_score SMALLINT,
  ADD COLUMN IF NOT EXISTS perceptual_hash TEXT,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS validation_warnings JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_item_images_business_phash
  ON public.item_images (business_id, perceptual_hash);

CREATE INDEX IF NOT EXISTS idx_rental_item_images_business_phash
  ON public.rental_item_images (business_id, perceptual_hash);

COMMENT ON COLUMN public.item_images.quality_score IS 'Image quality score 0-100 from validation pipeline';
COMMENT ON COLUMN public.item_images.perceptual_hash IS 'Blockhash for duplicate detection';
COMMENT ON COLUMN public.item_images.validation_errors IS 'Blocking validation issues at upload time';
COMMENT ON COLUMN public.item_images.validation_warnings IS 'Non-blocking validation warnings at upload time';

COMMENT ON COLUMN public.rental_item_images.quality_score IS 'Image quality score 0-100 from validation pipeline';
COMMENT ON COLUMN public.rental_item_images.perceptual_hash IS 'Blockhash for duplicate detection';
COMMENT ON COLUMN public.rental_item_images.validation_errors IS 'Blocking validation issues at upload time';
COMMENT ON COLUMN public.rental_item_images.validation_warnings IS 'Non-blocking validation warnings at upload time';
