-- Default rental list on the client landing. The flag stays off.
-- Do not enable it from this migration. Prod and DEV stay unchanged.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_default_list_enabled',
  'Rentals default list',
  'Client rentals landing lists the market catalog before a search. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_default_list_enabled' AND country_code IS NULL
);
