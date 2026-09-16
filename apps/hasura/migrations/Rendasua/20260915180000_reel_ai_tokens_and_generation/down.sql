DELETE FROM public.application_configurations
WHERE config_key = 'veo_reel_tier';

DROP TABLE IF EXISTS public.reel_ai_generations;
DROP TABLE IF EXISTS public.business_ai_reel_token_usage;

ALTER TABLE public.reels
  DROP COLUMN IF EXISTS generation_prompt,
  DROP COLUMN IF EXISTS prompt_preset;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS ai_reel_tokens;

-- Enum values (reel_ai_token, generating) cannot be safely removed in Postgres.
