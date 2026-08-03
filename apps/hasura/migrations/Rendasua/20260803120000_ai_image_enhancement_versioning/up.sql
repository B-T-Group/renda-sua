-- Non-destructive AI image enhancement versioning + confidence placeholders

CREATE TYPE public.image_active_version AS ENUM ('original', 'enhanced');

CREATE TYPE public.ai_image_cleanup_confidence_tier AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE public.ai_image_cleanup_job_mode AS ENUM (
  'review_all',
  'auto_apply'
);

CREATE TYPE public.ai_image_cleanup_job_source AS ENUM (
  'creation',
  'library',
  'item_detail',
  'variant',
  'rental'
);

-- ---------------------------------------------------------------------------
-- item_images version columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.item_images
  ADD COLUMN IF NOT EXISTS original_image_url text,
  ADD COLUMN IF NOT EXISTS original_s3_key text,
  ADD COLUMN IF NOT EXISTS enhanced_image_url text,
  ADD COLUMN IF NOT EXISTS enhanced_s3_key text,
  ADD COLUMN IF NOT EXISTS active_version public.image_active_version NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS enhanced_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_hash text;

UPDATE public.item_images
SET
  original_image_url = COALESCE(original_image_url, image_url),
  original_s3_key = COALESCE(original_s3_key, s3_key)
WHERE original_image_url IS NULL;

-- Keep original_image_url nullable for legacy insert paths; trigger fills it.
CREATE OR REPLACE FUNCTION public.ensure_image_original_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.original_image_url IS NULL OR NEW.original_image_url = '' THEN
    NEW.original_image_url := NEW.image_url;
  END IF;
  IF NEW.original_s3_key IS NULL THEN
    NEW.original_s3_key := NEW.s3_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_images_ensure_original ON public.item_images;
CREATE TRIGGER trg_item_images_ensure_original
  BEFORE INSERT OR UPDATE OF image_url, s3_key ON public.item_images
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_image_original_version();

-- Backfill enhanced columns for already-cleaned images (best-effort: live URL is enhanced)
UPDATE public.item_images
SET
  enhanced_image_url = image_url,
  enhanced_s3_key = s3_key,
  active_version = 'enhanced',
  enhanced_at = COALESCE(enhanced_at, updated_at)
WHERE is_ai_cleaned = true
  AND enhanced_image_url IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_images_content_hash
  ON public.item_images (business_id, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN public.item_images.original_image_url IS
  'Immutable original upload URL; never destroyed by AI enhancement';
COMMENT ON COLUMN public.item_images.enhanced_image_url IS
  'AI-enhanced image URL when available';
COMMENT ON COLUMN public.item_images.active_version IS
  'Which version image_url/s3_key currently point at';
COMMENT ON COLUMN public.item_images.content_hash IS
  'Optional hash of original bytes for enhancement dedupe';

-- ---------------------------------------------------------------------------
-- item_variant_images version columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.item_variant_images
  ADD COLUMN IF NOT EXISTS original_image_url text,
  ADD COLUMN IF NOT EXISTS original_s3_key text,
  ADD COLUMN IF NOT EXISTS enhanced_image_url text,
  ADD COLUMN IF NOT EXISTS enhanced_s3_key text,
  ADD COLUMN IF NOT EXISTS active_version public.image_active_version NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS enhanced_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_hash text;

UPDATE public.item_variant_images
SET
  original_image_url = COALESCE(original_image_url, image_url),
  original_s3_key = COALESCE(original_s3_key, s3_key)
WHERE original_image_url IS NULL;

DROP TRIGGER IF EXISTS trg_item_variant_images_ensure_original ON public.item_variant_images;
CREATE TRIGGER trg_item_variant_images_ensure_original
  BEFORE INSERT OR UPDATE OF image_url, s3_key ON public.item_variant_images
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_image_original_version();

UPDATE public.item_variant_images
SET
  enhanced_image_url = image_url,
  enhanced_s3_key = s3_key,
  active_version = 'enhanced',
  enhanced_at = COALESCE(enhanced_at, updated_at)
WHERE is_ai_cleaned = true
  AND enhanced_image_url IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_variant_images_content_hash
  ON public.item_variant_images (content_hash)
  WHERE content_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- rental_item_images version columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.rental_item_images
  ADD COLUMN IF NOT EXISTS original_image_url text,
  ADD COLUMN IF NOT EXISTS original_s3_key text,
  ADD COLUMN IF NOT EXISTS enhanced_image_url text,
  ADD COLUMN IF NOT EXISTS enhanced_s3_key text,
  ADD COLUMN IF NOT EXISTS active_version public.image_active_version NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS enhanced_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_hash text;

UPDATE public.rental_item_images
SET
  original_image_url = COALESCE(original_image_url, image_url),
  original_s3_key = COALESCE(original_s3_key, s3_key)
WHERE original_image_url IS NULL;

DROP TRIGGER IF EXISTS trg_rental_item_images_ensure_original ON public.rental_item_images;
CREATE TRIGGER trg_rental_item_images_ensure_original
  BEFORE INSERT OR UPDATE OF image_url, s3_key ON public.rental_item_images
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_image_original_version();

UPDATE public.rental_item_images
SET
  enhanced_image_url = image_url,
  enhanced_s3_key = s3_key,
  active_version = 'enhanced',
  enhanced_at = COALESCE(enhanced_at, updated_at)
WHERE is_ai_cleaned = true
  AND enhanced_image_url IS NULL;

CREATE INDEX IF NOT EXISTS idx_rental_item_images_content_hash
  ON public.rental_item_images (content_hash)
  WHERE content_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ai_image_cleanup_results confidence + apply metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_image_cleanup_results
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS confidence_tier public.ai_image_cleanup_confidence_tier,
  ADD COLUMN IF NOT EXISTS confidence_signals jsonb,
  ADD COLUMN IF NOT EXISTS changes jsonb,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_model text;

COMMENT ON COLUMN public.ai_image_cleanup_results.confidence_tier IS
  'high|medium|low — drives auto-apply vs hold-for-review';
COMMENT ON COLUMN public.ai_image_cleanup_results.changes IS
  'Human-readable list of cosmetic changes detected by confidence scoring';

-- ---------------------------------------------------------------------------
-- ai_image_cleanup_jobs mode + source; allow library jobs without item
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_image_cleanup_jobs
  ADD COLUMN IF NOT EXISTS mode public.ai_image_cleanup_job_mode NOT NULL DEFAULT 'review_all',
  ADD COLUMN IF NOT EXISTS source public.ai_image_cleanup_job_source NOT NULL DEFAULT 'creation';

ALTER TABLE public.ai_image_cleanup_jobs
  ALTER COLUMN item_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Support rental_item_images on cleanup results (async rental enhance)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_image_cleanup_results
  ALTER COLUMN business_image_id DROP NOT NULL;

ALTER TABLE public.ai_image_cleanup_results
  ADD COLUMN IF NOT EXISTS rental_item_image_id uuid
    REFERENCES public.rental_item_images(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

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

CREATE INDEX IF NOT EXISTS idx_ai_image_cleanup_results_rental_image
  ON public.ai_image_cleanup_results (rental_item_image_id)
  WHERE rental_item_image_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- businesses: remembered auto-enhance preference
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS auto_enhance_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.businesses.auto_enhance_enabled IS
  'When true, product photo uploads default to AI enhancement (1 token each)';
