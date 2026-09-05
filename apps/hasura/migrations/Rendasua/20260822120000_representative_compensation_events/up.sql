-- Representative compensation ledger: milestone upgrades, 1% sale share,
-- and B2B 10-item referral. Amounts are country-scoped in application_configurations.

CREATE TABLE public.representative_compensation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_code text NOT NULL
    CHECK (rule_code IN (
      'onboarding_10_first_sale',
      'onboarding_25_small_sale',
      'onboarding_25_large_sale',
      'sale_percent',
      'business_referral_10_items'
    )),

  earner_agent_id uuid NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  earner_business_id uuid NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  earner_user_id uuid NOT NULL
    REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  business_id uuid NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  triggering_order_id uuid NULL
    REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  referred_agent_id uuid NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  amount numeric NOT NULL CHECK (amount > 0),
  gross_milestone_amount numeric NULL,
  currency public.currency_enum NOT NULL,
  country_code text NOT NULL,
  rail text NULL CHECK (rail IS NULL OR rail IN ('stripe', 'mobile_money')),
  item_count int NULL,
  sale_amount numeric NULL,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'credited', 'failed')),
  account_id uuid NULL
    REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  account_transaction_id uuid NULL,
  reference_id uuid NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT representative_compensation_events_earner_check CHECK (
    (earner_agent_id IS NOT NULL AND earner_business_id IS NULL)
    OR (earner_agent_id IS NULL AND earner_business_id IS NOT NULL)
  ),
  CONSTRAINT representative_compensation_events_sale_percent_order_check CHECK (
    rule_code <> 'sale_percent' OR triggering_order_id IS NOT NULL
  ),
  CONSTRAINT uq_representative_compensation_events_reference UNIQUE (reference_id)
);

COMMENT ON TABLE public.representative_compensation_events IS
  'Immutable representative compensation ledger. One row per credit (milestone delta, 1% sale, or B2B referral).';
COMMENT ON COLUMN public.representative_compensation_events.amount IS
  'Wallet credit for this event (milestone upgrade difference, or 1% of order subtotal).';
COMMENT ON COLUMN public.representative_compensation_events.gross_milestone_amount IS
  'Highest qualifying onboarding tier gross after this event (null for sale_percent / B2B).';
COMMENT ON COLUMN public.representative_compensation_events.reference_id IS
  'Deterministic UUID used as account_transactions.reference_id for deposit idempotency.';

CREATE UNIQUE INDEX uq_rce_business_onboarding_rule
  ON public.representative_compensation_events (business_id, rule_code)
  WHERE rule_code IN (
    'onboarding_10_first_sale',
    'onboarding_25_small_sale',
    'onboarding_25_large_sale',
    'business_referral_10_items'
  )
  AND business_id IS NOT NULL;

CREATE UNIQUE INDEX uq_rce_order_sale_percent
  ON public.representative_compensation_events (triggering_order_id, rule_code)
  WHERE rule_code = 'sale_percent'
  AND triggering_order_id IS NOT NULL;

CREATE INDEX idx_rce_earner_agent_created
  ON public.representative_compensation_events (earner_agent_id, created_at DESC)
  WHERE earner_agent_id IS NOT NULL;

CREATE INDEX idx_rce_earner_business_created
  ON public.representative_compensation_events (earner_business_id, created_at DESC)
  WHERE earner_business_id IS NOT NULL;

CREATE INDEX idx_rce_status_pending
  ON public.representative_compensation_events (status)
  WHERE status IN ('pending', 'failed');

CREATE INDEX idx_rce_business_id
  ON public.representative_compensation_events (business_id)
  WHERE business_id IS NOT NULL;

CREATE TRIGGER set_public_representative_compensation_events_updated_at
  BEFORE UPDATE ON public.representative_compensation_events
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Pyramid distributions can attach to the new ledger
ALTER TABLE public.referral_bonus_distributions
  ADD COLUMN IF NOT EXISTS compensation_event_id uuid NULL
    REFERENCES public.representative_compensation_events(id)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.referral_bonus_distributions
  DROP CONSTRAINT IF EXISTS referral_bonus_distributions_source_check;

ALTER TABLE public.referral_bonus_distributions
  ADD CONSTRAINT referral_bonus_distributions_source_check CHECK (
    (
      business_referral_payout_id IS NOT NULL
      AND agent_referral_id IS NULL
      AND compensation_event_id IS NULL
    )
    OR (
      business_referral_payout_id IS NULL
      AND agent_referral_id IS NOT NULL
      AND compensation_event_id IS NULL
    )
    OR (
      business_referral_payout_id IS NULL
      AND agent_referral_id IS NULL
      AND compensation_event_id IS NOT NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_bonus_distributions_comp_gen
  ON public.referral_bonus_distributions (compensation_event_id, generation)
  WHERE compensation_event_id IS NOT NULL;

COMMENT ON COLUMN public.referral_bonus_distributions.compensation_event_id IS
  'Representative compensation event this pyramid share belongs to.';

-- Country-scoped amounts and sale bands
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'onboarding_10_first_sale_amount',
    'Onboarding 10 items + first sale (Cameroon)',
    'Gross onboarding bonus when a referred business has ≥10 approved items and at least one completed sale (XAF).',
    'number', 7500.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_10_first_sale_amount',
    'Onboarding 10 items + first sale (Gabon)',
    'Gross onboarding bonus when a referred business has ≥10 approved items and at least one completed sale (XAF).',
    'number', 7500.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_10_first_sale_amount',
    'Onboarding 10 items + first sale (Canada)',
    'Gross onboarding bonus when a referred business has ≥10 approved items and at least one completed sale (CAD).',
    'number', 25.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_25_small_sale_amount',
    'Onboarding 25 items + small sale (Cameroon)',
    'Gross onboarding bonus at ≥25 approved items with a completed sale below onboarding_small_sale_max (XAF).',
    'number', 10000.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_25_small_sale_amount',
    'Onboarding 25 items + small sale (Gabon)',
    'Gross onboarding bonus at ≥25 approved items with a completed sale below onboarding_small_sale_max (XAF).',
    'number', 10000.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_25_small_sale_amount',
    'Onboarding 25 items + small sale (Canada)',
    'Gross onboarding bonus at ≥25 approved items with a completed sale below onboarding_small_sale_max (CAD).',
    'number', 40.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_25_large_sale_amount',
    'Onboarding 25 items + large/above sale (Cameroon)',
    'Gross onboarding bonus at ≥25 approved items with a completed sale at or above onboarding_small_sale_max (XAF). Sales above the large band still use this amount.',
    'number', 15000.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_25_large_sale_amount',
    'Onboarding 25 items + large/above sale (Gabon)',
    'Gross onboarding bonus at ≥25 approved items with a completed sale at or above onboarding_small_sale_max (XAF). Sales above the large band still use this amount.',
    'number', 15000.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_25_large_sale_amount',
    'Onboarding 25 items + large/above sale (Canada)',
    'Gross onboarding bonus at ≥25 approved items with a completed sale at or above onboarding_small_sale_max (CAD). Sales above the large band still use this amount.',
    'number', 50.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_small_sale_max',
    'Onboarding small-sale exclusive max (Cameroon)',
    'Completed sale subtotal must be strictly below this amount (XAF) to qualify for the 25-item small-sale tier.',
    'number', 10000.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_small_sale_max',
    'Onboarding small-sale exclusive max (Gabon)',
    'Completed sale subtotal must be strictly below this amount (XAF) to qualify for the 25-item small-sale tier.',
    'number', 10000.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_small_sale_max',
    'Onboarding small-sale exclusive max (Canada)',
    'Completed sale subtotal must be strictly below this amount (CAD) to qualify for the 25-item small-sale tier.',
    'number', 25.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_large_sale_max',
    'Onboarding large-sale inclusive max (Cameroon)',
    'Upper bound of the documented large-sale band (XAF). Sales above this still pay the large-sale onboarding amount.',
    'number', 25000.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_large_sale_max',
    'Onboarding large-sale inclusive max (Gabon)',
    'Upper bound of the documented large-sale band (XAF). Sales above this still pay the large-sale onboarding amount.',
    'number', 25000.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'onboarding_large_sale_max',
    'Onboarding large-sale inclusive max (Canada)',
    'Upper bound of the documented large-sale band (CAD). Sales above this still pay the large-sale onboarding amount.',
    'number', 75.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'onboarding'],
    'active'
  ),
  (
    'sale_only_commission_percent',
    'Sale-only commission percent (Cameroon)',
    'Percent of completed order subtotal paid to the onboarding agent when the order does not create or upgrade an onboarding milestone.',
    'number', 1.00, 'CM',
    ARRAY['agents', 'referrals', 'compensation', 'sale'],
    'active'
  ),
  (
    'sale_only_commission_percent',
    'Sale-only commission percent (Gabon)',
    'Percent of completed order subtotal paid to the onboarding agent when the order does not create or upgrade an onboarding milestone.',
    'number', 1.00, 'GA',
    ARRAY['agents', 'referrals', 'compensation', 'sale'],
    'active'
  ),
  (
    'sale_only_commission_percent',
    'Sale-only commission percent (Canada)',
    'Percent of completed order subtotal paid to the onboarding agent when the order does not create or upgrade an onboarding milestone.',
    'number', 1.00, 'CA',
    ARRAY['agents', 'referrals', 'compensation', 'sale'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO UPDATE
SET
  number_value = EXCLUDED.number_value,
  description = EXCLUDED.description,
  status = 'active',
  updated_at = NOW();

UPDATE public.application_configurations
SET
  number_value = 1000.00,
  description = 'Business-to-business referral commission after the referred business reaches 10 approved items (XAF).',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code IN ('CM', 'GA');

UPDATE public.application_configurations
SET
  number_value = 10.00,
  description = 'Business-to-business referral commission after the referred business reaches 10 approved items (CAD).',
  updated_at = NOW()
WHERE config_key = 'business_to_business_referral_amount'
  AND country_code = 'CA';

UPDATE public.application_configurations
SET
  number_value = 1000.00,
  description = 'Fixed commission credited to an agent for each successful agent referral (first completed delivery).',
  updated_at = NOW()
WHERE config_key = 'agent_referral_commission'
  AND country_code IN ('CM', 'GA');

INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'agent_referral_commission',
    'Agent Referral Commission (Canada)',
    'Fixed commission credited to an agent for each successful agent referral in Canada (CAD).',
    'number', 10.00, 'CA',
    ARRAY['agents', 'referrals', 'commission'],
    'active'
  ),
  (
    'max_agent_referral_commission',
    'Max Agent Referral Commission (Canada)',
    'Maximum total agent-referral commissions an agent can earn in Canada (CAD).',
    'number', 100.00, 'CA',
    ARRAY['agents', 'referrals', 'commission'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO UPDATE
SET
  number_value = EXCLUDED.number_value,
  description = EXCLUDED.description,
  status = 'active',
  updated_at = NOW();
