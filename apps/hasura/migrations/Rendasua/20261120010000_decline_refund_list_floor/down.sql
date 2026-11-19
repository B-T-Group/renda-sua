ALTER TABLE public.application_configurations
  DROP CONSTRAINT IF EXISTS rentals_fedapay_list_confirm_floor,
  DROP CONSTRAINT IF EXISTS rentals_fedapay_list_lag_floor;

-- The up migration writes min_value 10 and max_value 1440 without storing the previous numbers.
-- Put the seed min (1) and seed max (120) back on every lag and confirm row still holding those
-- written values, including tuned and country rows. A row an admin had already set to min 10 or
-- max 1440 is returned to the seed as well, because the previous value was not recorded.
UPDATE public.application_configurations
SET min_value = 1
WHERE min_value = 10
  AND config_key IN (
    'rentals_fedapay_list_lag_minutes',
    'rentals_fedapay_list_confirm_minutes'
  );

UPDATE public.application_configurations
SET max_value = 120
WHERE max_value = 1440
  AND config_key IN (
    'rentals_fedapay_list_lag_minutes',
    'rentals_fedapay_list_confirm_minutes'
  );
