DELETE FROM public.application_configurations
WHERE config_key = 'onboarding_x_self_sale_amount';

UPDATE public.application_configurations
SET
  config_key = 'onboarding_10_first_sale_amount',
  updated_at = NOW()
WHERE config_key = 'onboarding_x_first_sale_amount';

ALTER TABLE public.representative_compensation_events
  DROP CONSTRAINT IF EXISTS representative_compensation_events_rule_code_check;

ALTER TABLE public.representative_compensation_events
  DROP CONSTRAINT IF EXISTS representative_compensation_events_onboarding_order_check;

UPDATE public.representative_compensation_events
SET rule_code = 'onboarding_10_first_sale'
WHERE rule_code = 'onboarding_x_first_sale';

ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_rule_code_check
  CHECK (rule_code IN (
    'onboarding_10_first_sale',
    'onboarding_25_small_sale',
    'onboarding_25_large_sale',
    'sale_percent',
    'business_referral_10_items'
  ));

ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_onboarding_order_check
  CHECK (
    rule_code NOT IN (
      'onboarding_10_first_sale',
      'onboarding_25_small_sale',
      'onboarding_25_large_sale'
    )
    OR triggering_order_id IS NOT NULL
    OR status <> 'pending'
  );

DROP INDEX IF EXISTS uq_rce_business_onboarding_rule;

CREATE UNIQUE INDEX uq_rce_business_onboarding_rule
  ON public.representative_compensation_events (business_id, rule_code)
  WHERE rule_code IN (
    'onboarding_10_first_sale',
    'onboarding_25_small_sale',
    'onboarding_25_large_sale',
    'business_referral_10_items'
  )
  AND business_id IS NOT NULL;
