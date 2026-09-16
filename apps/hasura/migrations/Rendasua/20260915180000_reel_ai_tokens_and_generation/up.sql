-- AI reel generation tokens + Veo generation tracking

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ai_reel_tokens integer NOT NULL DEFAULT 1
  CHECK (ai_reel_tokens >= 0);

-- Existing merchants get one free generation token
UPDATE public.businesses
SET ai_reel_tokens = 1
WHERE ai_reel_tokens IS NULL OR ai_reel_tokens < 1;

ALTER TYPE public.payment_entity_type ADD VALUE IF NOT EXISTS 'reel_ai_token';

ALTER TYPE public.reel_processing_status ADD VALUE IF NOT EXISTS 'generating';

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS prompt_preset text NULL,
  ADD COLUMN IF NOT EXISTS generation_prompt text NULL;

CREATE TABLE public.business_ai_reel_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  tokens_consumed integer NOT NULL DEFAULT 1 CHECK (tokens_consumed > 0),
  operation_type text NOT NULL CHECK (operation_type IN ('generate', 'purchase', 'refund')),
  reel_id uuid NULL REFERENCES public.reels(id) ON DELETE SET NULL,
  payment_reference text NULL,
  created_by_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX business_ai_reel_token_usage_business_created_idx
  ON public.business_ai_reel_token_usage (business_id, created_at DESC);

CREATE UNIQUE INDEX business_ai_reel_token_usage_payment_reference_key
  ON public.business_ai_reel_token_usage (payment_reference)
  WHERE payment_reference IS NOT NULL;

CREATE TABLE public.reel_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  gemini_operation_name text NULL,
  model text NOT NULL,
  preset_id text NOT NULL,
  user_prompt text NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  error text NULL,
  tokens_reserved integer NOT NULL DEFAULT 0 CHECK (tokens_reserved >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reel_ai_generations_status_updated_idx
  ON public.reel_ai_generations (status, updated_at)
  WHERE status IN ('pending', 'running');

CREATE UNIQUE INDEX reel_ai_generations_reel_id_key
  ON public.reel_ai_generations (reel_id);

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  string_value,
  country_code,
  status,
  version,
  tags,
  allowed_values
) VALUES (
  'veo_reel_tier',
  'Veo reel generation tier',
  'Gemini Veo model tier for AI product-ad reels. "lite" is default/cheaper; "fast" is higher quality at higher COGS. Merchant token price is unchanged.',
  'string',
  'lite',
  NULL,
  'active',
  1,
  ARRAY['ai','reels','veo','video'],
  ARRAY['lite','fast']
);
