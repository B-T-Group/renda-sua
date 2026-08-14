-- Split rembg (free bg removal) and AI cleanup into separate image versions + result kinds

-- ---------------------------------------------------------------------------
-- image_active_version: add rembg
-- ---------------------------------------------------------------------------
ALTER TYPE public.image_active_version ADD VALUE IF NOT EXISTS 'rembg';

-- ---------------------------------------------------------------------------
-- Cleanup result kind (rembg | ai); existing rows = ai
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ai_image_cleanup_kind'
  ) THEN
    CREATE TYPE public.ai_image_cleanup_kind AS ENUM ('rembg', 'ai');
  END IF;
END $$;

ALTER TABLE public.ai_image_cleanup_results
  ADD COLUMN IF NOT EXISTS kind public.ai_image_cleanup_kind;

UPDATE public.ai_image_cleanup_results
SET kind = 'ai'
WHERE kind IS NULL;

ALTER TABLE public.ai_image_cleanup_results
  ALTER COLUMN kind SET DEFAULT 'ai',
  ALTER COLUMN kind SET NOT NULL;

COMMENT ON COLUMN public.ai_image_cleanup_results.kind IS
  'Processing path: rembg (Lambda bg removal) or ai (OpenAI enhancement)';

CREATE INDEX IF NOT EXISTS idx_ai_image_cleanup_results_image_kind_open
  ON public.ai_image_cleanup_results (business_image_id, kind)
  WHERE business_image_id IS NOT NULL
    AND status IN ('queued', 'processing', 'ready');

CREATE INDEX IF NOT EXISTS idx_ai_image_cleanup_results_variant_kind_open
  ON public.ai_image_cleanup_results (item_variant_image_id, kind)
  WHERE item_variant_image_id IS NOT NULL
    AND status IN ('queued', 'processing', 'ready');

CREATE INDEX IF NOT EXISTS idx_ai_image_cleanup_results_rental_kind_open
  ON public.ai_image_cleanup_results (rental_item_image_id, kind)
  WHERE rental_item_image_id IS NOT NULL
    AND status IN ('queued', 'processing', 'ready');

-- ---------------------------------------------------------------------------
-- item_images rembg version columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.item_images
  ADD COLUMN IF NOT EXISTS rembg_image_url text,
  ADD COLUMN IF NOT EXISTS rembg_s3_key text,
  ADD COLUMN IF NOT EXISTS rembg_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_rembg_cleaned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.item_images.rembg_image_url IS
  'Background-removed image URL when rembg succeeded';
COMMENT ON COLUMN public.item_images.is_rembg_cleaned IS
  'True when a rembg version exists (independent of active_version)';
COMMENT ON COLUMN public.item_images.is_ai_cleaned IS
  'True when an AI-enhanced version exists (independent of active_version)';

CREATE INDEX IF NOT EXISTS idx_item_images_rembg_content_hash
  ON public.item_images (business_id, content_hash)
  WHERE content_hash IS NOT NULL AND rembg_image_url IS NOT NULL;

-- ---------------------------------------------------------------------------
-- item_variant_images rembg version columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.item_variant_images
  ADD COLUMN IF NOT EXISTS rembg_image_url text,
  ADD COLUMN IF NOT EXISTS rembg_s3_key text,
  ADD COLUMN IF NOT EXISTS rembg_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_rembg_cleaned boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- rental_item_images rembg version columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.rental_item_images
  ADD COLUMN IF NOT EXISTS rembg_image_url text,
  ADD COLUMN IF NOT EXISTS rembg_s3_key text,
  ADD COLUMN IF NOT EXISTS rembg_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_rembg_cleaned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rental_item_images_rembg_content_hash
  ON public.rental_item_images (content_hash)
  WHERE content_hash IS NOT NULL AND rembg_image_url IS NOT NULL;
