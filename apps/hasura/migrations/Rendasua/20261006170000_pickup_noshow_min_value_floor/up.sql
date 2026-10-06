-- Raise pickup_noshow_cancel_hours min_value floor from 0 to 1.
-- Context: backend validation already requires 1–168; a row with 0 would return
-- 500 on every pickup cancel attempt (issue #462 N-8).

-- Clamp any existing values < 1 to 1
UPDATE public.application_configurations
SET number_value = 1
WHERE config_key = 'pickup_noshow_cancel_hours'
  AND number_value IS NOT NULL
  AND number_value < 1;

-- Raise the floor
UPDATE public.application_configurations
SET min_value = 1
WHERE config_key = 'pickup_noshow_cancel_hours';
