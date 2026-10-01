DELETE FROM public.application_configurations
WHERE config_key = 'failed_delivery_fee_percent'
  AND country_code IN ('CM', 'GA');
