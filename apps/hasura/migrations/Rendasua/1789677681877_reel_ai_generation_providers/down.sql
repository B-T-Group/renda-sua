ALTER TABLE public.reel_ai_generations
  DROP COLUMN IF EXISTS failure_category,
  DROP COLUMN IF EXISTS fallback_used,
  DROP COLUMN IF EXISTS original_provider,
  DROP COLUMN IF EXISTS generation_tier,
  DROP COLUMN IF EXISTS provider_job_id,
  DROP COLUMN IF EXISTS provider;
