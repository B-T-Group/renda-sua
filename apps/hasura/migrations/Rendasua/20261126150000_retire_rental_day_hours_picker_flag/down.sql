-- Restores the global row as 20261125190000_rental_day_hours_picker seeded it (false).
-- Country rows and any value set by hand are not restored.
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_day_hours_picker_enabled',
  'Rental day-and-hours picker',
  'One sheet to pick days, then Full day or Hours per day. Adds the listing switches Rent by the day / Rent by the hour, and turns on the server rules for days in a row, per-block min/max hours and the 2-hour lead time. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_day_hours_picker_enabled' AND country_code IS NULL
);
