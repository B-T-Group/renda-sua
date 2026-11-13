DELETE FROM public.application_configurations
WHERE config_key = 'rentals_card_charge_at_pickup_enabled'
  AND country_code IS NULL
  AND boolean_value = false;
