UPDATE public.application_configurations
SET
  description = 'Gemini Veo model tier fallback for AI product-ad reels. Merchants choose lite/fast/standard per generate; token cost depends on tier and audio.',
  allowed_values = ARRAY['lite', 'fast', 'standard'],
  updated_at = NOW()
WHERE config_key = 'veo_reel_tier';
