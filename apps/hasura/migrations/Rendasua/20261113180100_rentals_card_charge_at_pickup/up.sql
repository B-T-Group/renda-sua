-- Card charge at pickup. The flag stays false. Dev is turned on by hand. Production stays off.

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  status,
  version,
  tags
)
SELECT
  'rentals_card_charge_at_pickup_enabled',
  'Rental card charge at pickup',
  'When enabled, an inspected Stripe rental is charged at pickup and is not limited by the 6-day card authorization. Default off.',
  'boolean',
  false,
  'active',
  1,
  ARRAY['rentals', 'payments', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1
  FROM public.application_configurations
  WHERE config_key = 'rentals_card_charge_at_pickup_enabled'
    AND country_code IS NULL
);
