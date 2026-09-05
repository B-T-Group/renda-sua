-- Reverse: restore standard CM/GA business-referral amount to 2000 XAF.

UPDATE public.application_configurations
SET
  number_value = 2000.00,
  description = 'Standard business-referral commission (XAF) for non-internal users after review + 10 approved items.',
  updated_at = NOW()
WHERE config_key = 'business_referral_payout_amount'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET
  number_value = 2000.00,
  description = 'Deprecated: use business_referral_payout_amount. Unified standard business-referral amount (XAF).',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code IN ('CM', 'GA');
