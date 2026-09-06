-- Enable in-app merchant agreement signing for every onboarding country.
-- Previously only CM/GA (and later TG/BJ/CI/CG) were seeded; US/CA defaulted to BoldSign.

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  string_value,
  country_code,
  tags,
  status,
  allowed_values
)
SELECT
  'merchant_agreement_provider',
  'Merchant Agreement Provider (' || TRIM(c.country_code) || ')',
  'How merchant partnership agreements are collected for this country. Values: boldsign | in_app. Absence of a row defaults to in_app.',
  'string',
  'in_app',
  TRIM(c.country_code),
  ARRAY['merchant', 'agreement', 'boldsign'],
  'active',
  ARRAY['boldsign', 'in_app']
FROM public.country_onboarding_configs c
ON CONFLICT (config_key, country_code) DO UPDATE
SET
  string_value = 'in_app',
  status = 'active',
  description = EXCLUDED.description,
  updated_at = NOW();
