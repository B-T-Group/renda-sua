-- Country-level merchant agreement provider + acceptance audit columns
-- and CM/GA commission backfill for deprecated location commission column.

-- 1) Seed merchant_agreement_provider = in_app for Cameroon and Gabon
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  string_value,
  country_code,
  tags,
  status,
  allowed_values
) VALUES
(
  'merchant_agreement_provider',
  'Merchant Agreement Provider (Cameroon)',
  'How merchant partnership agreements are collected for this country. Values: boldsign | in_app. Absence of a row defaults to boldsign.',
  'string',
  'in_app',
  'CM',
  ARRAY['merchant', 'agreement', 'boldsign'],
  'active',
  ARRAY['boldsign', 'in_app']
),
(
  'merchant_agreement_provider',
  'Merchant Agreement Provider (Gabon)',
  'How merchant partnership agreements are collected for this country. Values: boldsign | in_app. Absence of a row defaults to boldsign.',
  'string',
  'in_app',
  'GA',
  ARRAY['merchant', 'agreement', 'boldsign'],
  'active',
  ARRAY['boldsign', 'in_app']
)
ON CONFLICT (config_key, country_code) DO UPDATE
SET
  string_value = EXCLUDED.string_value,
  status = 'active',
  updated_at = NOW();

-- 2) Extend in-app acceptance audit trail
ALTER TABLE public.business_merchant_agreement_acceptances
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS device_info JSONB;

CREATE INDEX IF NOT EXISTS idx_bmaa_user_id
  ON public.business_merchant_agreement_acceptances(user_id);

CREATE INDEX IF NOT EXISTS idx_bmaa_country_code
  ON public.business_merchant_agreement_acceptances(country_code);

COMMENT ON COLUMN public.business_merchant_agreement_acceptances.user_id IS
  'User who accepted the agreement (signer account)';
COMMENT ON COLUMN public.business_merchant_agreement_acceptances.country_code IS
  'ISO alpha-2 country resolved server-side at acceptance time';
COMMENT ON COLUMN public.business_merchant_agreement_acceptances.device_info IS
  'Client-reported device metadata (platform, OS, model, app version)';

-- 3) Backfill deprecated location commission % for CM/GA to country plan rates
--    STANDARD=7, PREMIUM=12, ELITE=15 (runtime commission uses account_type map)
UPDATE public.business_locations bl
SET rendasua_item_commission_percentage = CASE b.account_type
  WHEN 'PREMIUM' THEN 12
  WHEN 'ELITE' THEN 15
  ELSE 7
END
FROM public.businesses b, public.addresses a
WHERE bl.business_id = b.id
  AND a.id = bl.address_id
  AND UPPER(COALESCE(a.country, '')) IN ('CM', 'GA', 'CAMEROON', 'GABON');
