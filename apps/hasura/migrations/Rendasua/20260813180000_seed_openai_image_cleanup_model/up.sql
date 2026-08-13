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
  'openai_image_cleanup_model',
  'OpenAI image cleanup model',
  'Model used for AI product-photo cleanup (Images Edits API). "gpt-image-1-mini" is cheaper; "gpt-image-1.5" forces the higher-fidelity model for all edits. Blurry photos may still upgrade to gpt-image-1.5 when the default is mini.',
  'string',
  'gpt-image-1-mini',
  NULL,
  'active',
  1,
  ARRAY['ai','images','cleanup','openai'],
  ARRAY['gpt-image-1-mini','gpt-image-1.5']
);
