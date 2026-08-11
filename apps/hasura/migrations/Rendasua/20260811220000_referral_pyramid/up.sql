-- Migration: 20260811220000_referral_pyramid
-- Description: Agent referral parent columns, referral_bonus_distributions ledger,
--              and pyramid percent configs (5% / 3% / 1%).

-- 1) Agent referral attribution (mirror businesses)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS referred_by_agent_id uuid NULL
    REFERENCES public.agents(id) ON DELETE SET NULL;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS referred_by_business_id uuid NULL
    REFERENCES public.businesses(id) ON DELETE SET NULL;

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS referral_code_used text NULL;

CREATE INDEX IF NOT EXISTS agents_referred_by_agent_id_idx
  ON public.agents (referred_by_agent_id)
  WHERE referred_by_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agents_referred_by_business_id_idx
  ON public.agents (referred_by_business_id)
  WHERE referred_by_business_id IS NOT NULL;

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_single_referrer_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_single_referrer_check
  CHECK (
    NOT (
      referred_by_agent_id IS NOT NULL
      AND referred_by_business_id IS NOT NULL
    )
  );

COMMENT ON COLUMN public.agents.referred_by_agent_id IS
  'Agent who referred this agent at signup/persona-add (immutable after creation)';
COMMENT ON COLUMN public.agents.referred_by_business_id IS
  'Business that referred this agent at signup/persona-add (immutable after creation)';
COMMENT ON COLUMN public.agents.referral_code_used IS
  'Referral code entered when this agent persona was created';

-- 1b) Allow business→agent referrals on agent_referrals
ALTER TABLE public.agent_referrals
  ALTER COLUMN referring_agent_id DROP NOT NULL;

ALTER TABLE public.agent_referrals
  ADD COLUMN IF NOT EXISTS referrer_business_id uuid NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public.agent_referrals
  DROP CONSTRAINT IF EXISTS agent_referrals_referrer_check;

ALTER TABLE public.agent_referrals
  ADD CONSTRAINT agent_referrals_referrer_check
  CHECK (
    (referring_agent_id IS NOT NULL AND referrer_business_id IS NULL)
    OR (referring_agent_id IS NULL AND referrer_business_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_referrals_referred_agent_id
  ON public.agent_referrals (referred_agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_referrals_referrer_business_id
  ON public.agent_referrals (referrer_business_id)
  WHERE referrer_business_id IS NOT NULL;

COMMENT ON COLUMN public.agent_referrals.referrer_business_id IS
  'Business that referred the agent when referral is business-to-agent.';

-- 2) Per-beneficiary distribution ledger (one row + transaction per share)
CREATE TABLE IF NOT EXISTS public.referral_bonus_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_referral_payout_id uuid NULL
    REFERENCES public.business_referral_payouts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  agent_referral_id uuid NULL
    REFERENCES public.agent_referrals(id) ON UPDATE CASCADE ON DELETE CASCADE,

  generation smallint NOT NULL CHECK (generation >= 0 AND generation <= 3),

  beneficiary_agent_id uuid NULL
    REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  beneficiary_business_id uuid NULL
    REFERENCES public.businesses(id) ON UPDATE CASCADE ON DELETE RESTRICT,

  account_id uuid NOT NULL
    REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  transaction_id uuid NULL,
  amount numeric NOT NULL,
  memo text NOT NULL,
  reference_id text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_bonus_distributions_source_check CHECK (
    (business_referral_payout_id IS NOT NULL AND agent_referral_id IS NULL)
    OR (business_referral_payout_id IS NULL AND agent_referral_id IS NOT NULL)
  ),
  CONSTRAINT referral_bonus_distributions_beneficiary_check CHECK (
    (beneficiary_agent_id IS NOT NULL AND beneficiary_business_id IS NULL)
    OR (beneficiary_agent_id IS NULL AND beneficiary_business_id IS NOT NULL)
  ),
  CONSTRAINT uq_referral_bonus_distributions_reference UNIQUE (reference_id)
);

COMMENT ON TABLE public.referral_bonus_distributions IS
  'One row per beneficiary (earner + upline) for a referral bonus event; each has its own account transaction.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_bonus_distributions_biz_gen
  ON public.referral_bonus_distributions (business_referral_payout_id, generation)
  WHERE business_referral_payout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_bonus_distributions_agent_gen
  ON public.referral_bonus_distributions (agent_referral_id, generation)
  WHERE agent_referral_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_bonus_distributions_beneficiary_agent
  ON public.referral_bonus_distributions (beneficiary_agent_id)
  WHERE beneficiary_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_bonus_distributions_beneficiary_business
  ON public.referral_bonus_distributions (beneficiary_business_id)
  WHERE beneficiary_business_id IS NOT NULL;

CREATE TRIGGER set_public_referral_bonus_distributions_updated_at
  BEFORE UPDATE ON public.referral_bonus_distributions
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 3) Pyramid percent configs (global)
INSERT INTO public.application_configurations (
  config_key, config_name, description, data_type, number_value, country_code, tags, status
) VALUES
  (
    'referral_pyramid_gen1_percent',
    'Referral Pyramid Gen1 Percent',
    'Percent of gross one-time referral bonus paid to the earner''s direct referrer (1st generation parent).',
    'number', 5.00, NULL,
    ARRAY['referrals', 'commission', 'pyramid'],
    'active'
  ),
  (
    'referral_pyramid_gen2_percent',
    'Referral Pyramid Gen2 Percent',
    'Percent of gross one-time referral bonus paid to the 2nd generation parent.',
    'number', 3.00, NULL,
    ARRAY['referrals', 'commission', 'pyramid'],
    'active'
  ),
  (
    'referral_pyramid_gen3_percent',
    'Referral Pyramid Gen3 Percent',
    'Percent of gross one-time referral bonus paid to the 3rd generation parent.',
    'number', 1.00, NULL,
    ARRAY['referrals', 'commission', 'pyramid'],
    'active'
  )
ON CONFLICT (config_key, country_code) DO NOTHING;
