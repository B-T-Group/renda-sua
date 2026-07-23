-- Migration: 20260723150000_update_canada_referral_payout_25_cad
-- Description: Raise the Stripe-rail referral payout for Canada from CAD 10 to CAD 25.

UPDATE public.application_configurations
SET
  number_value = 25.00,
  description  = 'Commission credited to an agent per referred business with 10+ items in Canada (CAD). Stripe rail agents receive 25 CAD.',
  updated_at   = NOW()
WHERE config_key   = 'business_referral_payout_amount'
  AND country_code = 'CA';
