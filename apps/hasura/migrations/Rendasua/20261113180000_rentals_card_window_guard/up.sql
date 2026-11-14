-- Card date guard for inspected rentals.
-- Inserts false. Turn it on by hand in DEV. Production stays off.
-- Do not enable this from apply-hasura or a workflow.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_card_window_guard_enabled',
  'Rental card window guard',
  'When true, the date picker blocks card ends after latest_card_end_at and POST /rentals/requests rejects an unfit inspected card window. Response fields stay available while this is false. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_card_window_guard_enabled' AND country_code IS NULL
);

-- Hook only. Charge-at-pickup is a separate payments change. Seeded false.
-- When a later change turns this on, inspected Stripe bookings are not date-limited
-- by the 6-day authorization window. Do not enable it from a workflow.

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, boolean_value,
  country_code, status, version, tags
)
SELECT
  'rentals_card_charge_at_pickup_enabled',
  'Rental card charge at pickup',
  'When true, an inspected Stripe-rail booking uses charge_at_pickup and latest_card_end_at is null. The payment flow is not implemented by this flag. Country row first, then global row, default false.',
  'boolean', false, NULL, 'active', 1,
  ARRAY['rentals', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'rentals_card_charge_at_pickup_enabled' AND country_code IS NULL
);
