-- Lag and confirm cannot drop below 10 minutes. Raise any shorter row before the check.
UPDATE public.application_configurations
SET min_value = 10
WHERE config_key IN (
  'rentals_fedapay_list_lag_minutes',
  'rentals_fedapay_list_confirm_minutes'
)
  AND (min_value IS NULL OR min_value < 10);

UPDATE public.application_configurations
SET number_value = 10
WHERE config_key IN (
  'rentals_fedapay_list_lag_minutes',
  'rentals_fedapay_list_confirm_minutes'
)
  AND number_value IS NOT NULL
  AND number_value < 10;

ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_fedapay_list_lag_floor,
  DROP CONSTRAINT IF EXISTS rentals_fedapay_list_confirm_floor;

ALTER TABLE public.application_configurations
  ADD CONSTRAINT rentals_fedapay_list_lag_floor CHECK (
    config_key <> 'rentals_fedapay_list_lag_minutes'
    OR number_value IS NULL
    OR number_value >= 10
  ),
  ADD CONSTRAINT rentals_fedapay_list_confirm_floor CHECK (
    config_key <> 'rentals_fedapay_list_confirm_minutes'
    OR number_value IS NULL
    OR number_value >= 10
  );
