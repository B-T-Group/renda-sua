DELETE FROM public.application_configurations
WHERE config_key = 'cancellation_fee_percent'
  AND country_code IN ('CM', 'GA', 'CA');
