-- Provider-agnostic video generation tracking on reel_ai_generations

ALTER TABLE public.reel_ai_generations
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'google'
    CHECK (provider IN ('google', 'runway')),
  ADD COLUMN IF NOT EXISTS provider_job_id text NULL,
  ADD COLUMN IF NOT EXISTS generation_tier text NOT NULL DEFAULT 'fast'
    CHECK (generation_tier IN ('fast', 'standard')),
  ADD COLUMN IF NOT EXISTS original_provider text NULL
    CHECK (original_provider IS NULL OR original_provider IN ('google', 'runway')),
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failure_category text NULL;

-- Backfill polling id from legacy Gemini operation name
UPDATE public.reel_ai_generations
SET provider_job_id = gemini_operation_name
WHERE provider_job_id IS NULL
  AND gemini_operation_name IS NOT NULL;

-- Infer tier from known Veo model ids when possible
UPDATE public.reel_ai_generations
SET generation_tier = 'standard'
WHERE model ILIKE '%veo-3.1-generate%'
  AND model NOT ILIKE '%fast%';
