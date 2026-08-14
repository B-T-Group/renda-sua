UPDATE public.application_configurations
SET
  string_value = 'gpt-image-1-mini',
  description = 'Model used for AI product-photo cleanup (Images Edits API). "gpt-image-1-mini" is cheaper; "gpt-image-1.5" forces the higher-fidelity model for all edits. Blurry photos may still upgrade to gpt-image-1.5 when the default is mini.',
  updated_at = NOW()
WHERE config_key = 'openai_image_cleanup_model';
