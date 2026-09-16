UPDATE public.application_configurations
SET
  string_value = 'fast',
  description = 'Gemini Veo model tier fallback for AI product-ad reels. Merchants choose fast/standard per generate; token cost depends on tier. Legacy "lite" maps to fast.',
  allowed_values = ARRAY['fast', 'standard'],
  updated_at = NOW()
WHERE config_key = 'veo_reel_tier';
