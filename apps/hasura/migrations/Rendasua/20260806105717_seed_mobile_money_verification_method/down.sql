DELETE FROM public.application_configurations
WHERE config_key = 'mobile_money_verification_method'
  AND country_code IS NULL;
