-- Rollback: 1810000000000_create_business_referral_payouts

-- 1) Remove seeded payout configurations
DELETE FROM public.application_configurations
WHERE config_key IN (
  'business_referral_payout_enabled',
  'business_referral_payout_amount'
)
AND (country_code IS NULL OR country_code IN ('CM', 'GA', 'CA'));

-- 2) Drop business_referral_payouts table (trigger drops with it)
DROP INDEX IF EXISTS idx_business_referral_payouts_agent_id;
DROP TABLE IF EXISTS public.business_referral_payouts;
