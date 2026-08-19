-- Migration: 20260819124900_raise_standard_xaf_referral_payout_to_5000
-- Standard (agent / non-internal) CM/GA commission matches internal at 5000 XAF.
-- B2B (no agent persona) stays at 2000 XAF via business_to_business_referral_amount.

UPDATE public.application_configurations
SET
  number_value = 5000.00,
  description = 'Business-referral commission (XAF) for non-internal users with an agent persona after review + 10 approved items.',
  updated_at = NOW()
WHERE config_key = 'business_referral_payout_amount'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET
  number_value = 2000.00,
  description = 'Business-to-business referral commission (XAF) when the referrer has no agent persona, after review + 10 approved items.',
  status = 'active',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code IN ('CM', 'GA');
