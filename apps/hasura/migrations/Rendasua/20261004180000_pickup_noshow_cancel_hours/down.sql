DELETE FROM public.application_configurations
WHERE config_key = 'pickup_noshow_cancel_hours'
  AND country_code IS NULL
  AND number_value = 2;
