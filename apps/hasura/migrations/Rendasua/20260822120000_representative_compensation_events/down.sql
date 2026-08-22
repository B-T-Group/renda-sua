DELETE FROM public.application_configurations
WHERE config_key IN (
  'onboarding_10_first_sale_amount',
  'onboarding_25_small_sale_amount',
  'onboarding_25_large_sale_amount',
  'onboarding_small_sale_max',
  'onboarding_large_sale_max',
  'sale_only_commission_percent'
);

DELETE FROM public.application_configurations
WHERE config_key IN ('agent_referral_commission', 'max_agent_referral_commission')
  AND country_code = 'CA';

UPDATE public.application_configurations
SET
  number_value = 500.00,
  description = 'Fixed commission amount credited to an agent for each successful referral.',
  updated_at = NOW()
WHERE config_key = 'agent_referral_commission'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET
  number_value = 2000.00,
  description = 'Business-to-business referral commission after review + 10 approved items (XAF).',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code IN ('CM', 'GA');

DROP INDEX IF EXISTS uq_referral_bonus_distributions_comp_gen;

ALTER TABLE public.referral_bonus_distributions
  DROP CONSTRAINT IF EXISTS referral_bonus_distributions_source_check;

ALTER TABLE public.referral_bonus_distributions
  DROP COLUMN IF EXISTS compensation_event_id;

ALTER TABLE public.referral_bonus_distributions
  ADD CONSTRAINT referral_bonus_distributions_source_check CHECK (
    (business_referral_payout_id IS NOT NULL AND agent_referral_id IS NULL)
    OR (business_referral_payout_id IS NULL AND agent_referral_id IS NOT NULL)
  );

DROP TABLE IF EXISTS public.representative_compensation_events;
