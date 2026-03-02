-- Rollback: 1802000000000_add_agent_code_and_referrals

-- 1) Remove seeded referral commission configurations for CM and GA
DELETE FROM public.application_configurations
WHERE config_key IN (
  'agent_referral_commission',
  'max_agent_referral_commission'
)
AND country_code IN ('CM', 'GA');

-- 2) Drop agent_referrals indexes and table
DROP INDEX IF EXISTS idx_agent_referrals_referred_agent_id;
DROP INDEX IF EXISTS idx_agent_referrals_referring_agent_id;

DROP TABLE IF EXISTS public.agent_referrals;

-- 3) Drop agent_code constraint and column from agents
ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_agent_code_key;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS agent_code;

