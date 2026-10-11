-- Discovery sort + empty-result recovery (#342). Flag only: no schema change, no locks.
-- Country row first, then global row, default false (same read pattern as every other flag).
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'discovery_sort_v1',
  'Discovery sort v1',
  'Sort modes (Recommended / Best match / Popular / Top rated / Newest), rating trust signal on cards and the empty-result recovery ladder. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['discovery', 'search', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'discovery_sort_v1' AND country_code IS NULL
);
