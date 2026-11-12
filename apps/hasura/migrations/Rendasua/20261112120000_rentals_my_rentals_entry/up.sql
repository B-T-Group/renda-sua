-- My rentals header and Next rental card on the search-first landing.
-- Inserts the flag off. DEV turns it on in a separate seed that production does not run.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_my_rentals_entry_enabled',
  'Rentals My rentals entry',
  'Search-first Rentals shows a My rentals header and a dismissible Next rental card. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_my_rentals_entry_enabled' AND country_code IS NULL
);
