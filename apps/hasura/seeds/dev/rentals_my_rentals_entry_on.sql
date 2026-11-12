-- DEV ONLY. apply-hasura-dev runs this after migrate.
-- Production applies the migration (boolean false) and does not run this file.

UPDATE public.application_configurations
SET boolean_value = true
WHERE config_key = 'rentals_my_rentals_entry_enabled'
  AND country_code IS NULL;
