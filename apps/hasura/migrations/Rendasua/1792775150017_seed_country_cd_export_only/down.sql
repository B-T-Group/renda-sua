DELETE FROM public.item_export_markets e
USING public.items i
WHERE e.item_id = i.id
  AND i.export_available = true
  AND e.country_code = 'CD';

DELETE FROM public.country_onboarding_configs
WHERE country_code = 'CD';

DELETE FROM public.supported_country_states
WHERE country_code = 'CD';
