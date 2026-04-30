DELETE FROM public.application_configurations
WHERE config_key = 'first_order_discount_percentage'
  AND country_code IS NULL;

