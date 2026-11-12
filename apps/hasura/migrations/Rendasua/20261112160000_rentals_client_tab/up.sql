-- Client Rentals tab on the sticky menu.
-- Inserts the flag off. Production stays off; DEV is turned on by hand.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_client_tab_enabled',
  'Client Rentals tab',
  'Client sticky nav shows Rentals (My rentals) and drops Search on mobile. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_client_tab_enabled' AND country_code IS NULL
);
