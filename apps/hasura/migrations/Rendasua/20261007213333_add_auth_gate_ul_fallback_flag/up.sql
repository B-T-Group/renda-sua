-- #338: auth_gate_ul_fallback — show the "Sign in with password" link (Auth0 Universal
-- Login) inside the in-app sign-in gate during the 2-week soak. The link only renders
-- where auth_web_inapp_gates is on, so a single global row is enough. Turn it off after
-- the soak by setting boolean_value = false (or add a per-country row).
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  country_code,
  status,
  version,
  tags
)
SELECT
  'auth_gate_ul_fallback',
  'Auth gate Universal Login fallback',
  'Show "Sign in with password" (Auth0 Universal Login) in the in-app sign-in gate. Only visible where auth_web_inapp_gates is on. #338 soak fallback.',
  'boolean',
  true,
  NULL,
  'active',
  1,
  ARRAY['auth', 'web', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'auth_gate_ul_fallback' AND country_code IS NULL
);
