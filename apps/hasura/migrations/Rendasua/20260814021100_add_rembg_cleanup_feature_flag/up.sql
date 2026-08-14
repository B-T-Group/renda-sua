-- Add REMBG cleanup feature flag to application_configurations
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  status,
  version,
  tags
) VALUES (
  'use_rembg_cleanup',
  'Use REMBG for image cleanup',
  'When enabled, use self-hosted REMBG Lambda for background removal instead of OpenAI. Falls back to OpenAI on failures. Significantly reduces costs ($0.001 vs $0.02-0.08 per image).',
  'boolean',
  false,
  'active',
  1,
  ARRAY['ai', 'images', 'cleanup', 'rembg', 'cost-optimization']
);
