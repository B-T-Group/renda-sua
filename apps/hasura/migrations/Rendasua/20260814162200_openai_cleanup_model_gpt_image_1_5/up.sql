UPDATE public.application_configurations
SET
  string_value = 'gpt-image-1.5',
  description = 'Model used for AI product-photo cleanup (Images Edits API). Default is gpt-image-1.5 (medium quality). Set gpt-image-1-mini for the cheaper model.',
  updated_at = NOW()
WHERE config_key = 'openai_image_cleanup_model';
