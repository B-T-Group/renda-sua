DELETE FROM public.application_configurations
WHERE config_key = 'onboarding_10_min_sale_total';

UPDATE public.application_configurations
SET description = 'Gross onboarding bonus when a referred business has ≥10 approved items and at least one completed sale (XAF).'
WHERE config_key = 'onboarding_10_first_sale_amount'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET description = 'Gross onboarding bonus when a referred business has ≥10 approved items and at least one completed sale (CAD).'
WHERE config_key = 'onboarding_10_first_sale_amount'
  AND country_code = 'CA';
