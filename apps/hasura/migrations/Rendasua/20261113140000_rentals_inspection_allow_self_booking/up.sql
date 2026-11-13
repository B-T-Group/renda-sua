-- DEV testing switch for inspected self-bookings.
-- Inserts false. Turn it on by hand in DEV. Production stays off.
-- Do not enable this from apply-hasura or a workflow.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_inspection_allow_self_booking',
  'Allow inspected self-booking',
  'When true, a user may book their own rental listing while condition inspections are on. The booking still enrols as inspected. Other enrolment checks stay in place. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_inspection_allow_self_booking' AND country_code IS NULL
);
