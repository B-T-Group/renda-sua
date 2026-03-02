-- Migration: 1802000000000_add_agent_code_and_referrals
-- Description: Add agent_code to agents, create agent_referrals table,
--              and seed referral commission application configurations.

-- 1) Add agent_code column to agents (nullable for backfill)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS agent_code text;

-- 2) Backfill agent_code for existing agents with a random 6-character alphanumeric slug
-- Use base64-encoded random bytes, translate special characters, then take 6 chars and uppercase.
UPDATE public.agents
SET agent_code = UPPER(
  SUBSTRING(
    TRANSLATE(ENCODE(gen_random_bytes(8), 'base64'), '/+=', 'ABC')
    FROM 1 FOR 6
  )
)
WHERE agent_code IS NULL;

-- 3) Enforce NOT NULL and uniqueness on agent_code
ALTER TABLE public.agents
  ALTER COLUMN agent_code SET NOT NULL;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_agent_code_key UNIQUE (agent_code);

COMMENT ON COLUMN public.agents.agent_code IS
  'Public 6-character alphanumeric slug used for agent referrals.';

-- 4) Create agent_referrals table
CREATE TABLE public.agent_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referring_agent_id uuid NOT NULL REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  referred_agent_id uuid NOT NULL REFERENCES public.agents(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  referral_code_used text NOT NULL,
  commission_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_referrals IS
  'Tracks referral relationships between agents and the commission earned per referral.';

CREATE INDEX idx_agent_referrals_referring_agent_id
  ON public.agent_referrals(referring_agent_id);

CREATE INDEX idx_agent_referrals_referred_agent_id
  ON public.agent_referrals(referred_agent_id);

-- 5) Seed referral commission application configurations for CM and GA
INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  number_value,
  country_code,
  tags,
  status
) VALUES
  (
    'agent_referral_commission',
    'Agent Referral Commission (Cameroon)',
    'Fixed commission amount credited to an agent for each successful referral in Cameroon.',
    'number',
    500.00,
    'CM',
    ARRAY['agents', 'referrals', 'commission'],
    'active'
  ),
  (
    'max_agent_referral_commission',
    'Max Agent Referral Commission (Cameroon)',
    'Maximum total referral commissions an agent can earn in Cameroon.',
    'number',
    10000.00,
    'CM',
    ARRAY['agents', 'referrals', 'commission'],
    'active'
  ),
  (
    'agent_referral_commission',
    'Agent Referral Commission (Gabon)',
    'Fixed commission amount credited to an agent for each successful referral in Gabon.',
    'number',
    500.00,
    'GA',
    ARRAY['agents', 'referrals', 'commission'],
    'active'
  ),
  (
    'max_agent_referral_commission',
    'Max Agent Referral Commission (Gabon)',
    'Maximum total referral commissions an agent can earn in Gabon.',
    'number',
    10000.00,
    'GA',
    ARRAY['agents', 'referrals', 'commission'],
    'active'
  );

