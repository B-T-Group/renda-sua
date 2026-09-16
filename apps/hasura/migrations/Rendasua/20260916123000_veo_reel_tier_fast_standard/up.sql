UPDATE public.application_configurations
SET
  string_value = 'fast',
  description = 'Gemini Veo model tier fallback for AI product-ad reels. Merchants choose lite/fast/standard per generate; token cost depends on tier and audio.',
  allowed_values = ARRAY['lite', 'fast', 'standard'],
  updated_at = NOW()
WHERE config_key = 'veo_reel_tier';

-- Welcome credit matches default generate cost (fast + audio = 2 tokens).
ALTER TABLE public.businesses
  ALTER COLUMN ai_reel_tokens SET DEFAULT 2;

UPDATE public.businesses
SET ai_reel_tokens = 2
WHERE ai_reel_tokens = 1;
