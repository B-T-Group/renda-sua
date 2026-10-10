-- Rename the one-time agent onboarding rule. Existing reference_id values stay
-- so a wallet deposit already keyed to the old rule is not paid again.

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'representative_compensation_events'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%onboarding_10_first_sale%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.representative_compensation_events DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END $$;

UPDATE public.representative_compensation_events
SET rule_code = 'onboarding_x_first_sale'
WHERE rule_code = 'onboarding_10_first_sale';

ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_rule_code_check
  CHECK (rule_code IN (
    'onboarding_x_first_sale',
    'onboarding_25_small_sale',
    'onboarding_25_large_sale',
    'sale_percent',
    'business_referral_10_items'
  ));

ALTER TABLE public.representative_compensation_events
  ADD CONSTRAINT representative_compensation_events_onboarding_order_check
  CHECK (
    rule_code NOT IN (
      'onboarding_x_first_sale',
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
    'onboarding_x_first_sale',
    'onboarding_25_small_sale',
    'onboarding_25_large_sale',
    'business_referral_10_items'
  )
  AND business_id IS NOT NULL;

UPDATE public.application_configurations
SET
  config_key = 'onboarding_x_first_sale_amount',
  config_name = 'Onboarding bonus, other buyer (' || country_code || ')',
  description = 'One-time onboarding bonus when someone other than the referring agent buys the qualifying sale.',
  updated_at = NOW()
WHERE config_key = 'onboarding_10_first_sale_amount';

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'onboarding_x_self_sale_amount',
    'Onboarding bonus, agent self-purchase (Cameroon)',
    'One-time onboarding bonus when the referring agent buys the qualifying sale (XAF).',
    'number', 5000.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_x_self_sale_amount',
    'Onboarding bonus, agent self-purchase (Gabon)',
    'One-time onboarding bonus when the referring agent buys the qualifying sale (XAF).',
    'number', 5000.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_x_self_sale_amount',
    'Onboarding bonus, agent self-purchase (Canada)',
    'One-time onboarding bonus when the referring agent buys the qualifying sale (CAD).',
    'number', 25.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO NOTHING;
