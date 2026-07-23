-- Rollback: restore Canada referral payout to CAD 10.

UPDATE public.application_configurations
SET
  number_value = 10.00,
  description  = 'Commission credited to an agent per referred business with 10+ items in Canada (CAD). Stripe rail agents receive 10 CAD.',
  updated_at   = NOW()
WHERE config_key   = 'business_referral_payout_amount'
  AND country_code = 'CA';
