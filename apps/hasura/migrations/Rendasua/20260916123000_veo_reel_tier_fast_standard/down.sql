UPDATE public.application_configurations
SET
  string_value = 'lite',
  description = 'Gemini Veo model tier for AI product-ad reels. "lite" is default/cheaper; "fast" is higher quality at higher COGS. Merchant token price is unchanged.',
  allowed_values = ARRAY['lite', 'fast'],
  updated_at = NOW()
WHERE config_key = 'veo_reel_tier';

ALTER TABLE public.businesses
  ALTER COLUMN ai_reel_tokens SET DEFAULT 1;
