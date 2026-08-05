DELETE FROM public.application_configurations
WHERE config_key = 'merchant_agreement_provider'
  AND country_code IN ('CM', 'GA');

ALTER TABLE public.business_merchant_agreement_acceptances
  DROP COLUMN IF EXISTS device_info,
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS user_id;
