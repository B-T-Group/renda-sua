DELETE FROM public.application_configurations
WHERE config_key = 'openai_image_cleanup_model'
  AND country_code IS NULL;
