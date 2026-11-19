ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_fedapay_list_confirm_floor,
  DROP CONSTRAINT IF EXISTS rentals_fedapay_list_lag_floor;

UPDATE public.application_configurations
SET min_value = 1
WHERE country_code IS NULL
  AND version = 1
  AND number_value = 10
  AND min_value = 10
  AND config_key IN (
    'rentals_fedapay_list_lag_minutes',
    'rentals_fedapay_list_confirm_minutes'
  );
