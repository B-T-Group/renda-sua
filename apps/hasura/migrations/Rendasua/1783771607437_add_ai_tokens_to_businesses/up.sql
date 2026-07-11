-- Replace image_cleanup_enabled feature flag with per-business AI token balance
ALTER TABLE public.businesses
  ADD COLUMN ai_tokens integer NOT NULL DEFAULT 20;

COMMENT ON COLUMN public.businesses.ai_tokens IS
  'Remaining AI credits for image cleanup. New businesses start with 20; super users (is_admin) are granted 1000.';

-- Existing super users get 1000 tokens
UPDATE public.businesses
SET ai_tokens = 1000
WHERE is_admin = true;

ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS image_cleanup_enabled;
