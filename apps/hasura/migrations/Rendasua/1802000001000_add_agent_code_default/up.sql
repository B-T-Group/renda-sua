-- Migration: 1802000001000_add_agent_code_default
-- Description: Add default generator for agents.agent_code so new agents
--              automatically receive a 6-character alphanumeric slug.

ALTER TABLE public.agents
  ALTER COLUMN agent_code
  SET DEFAULT UPPER(
    SUBSTRING(
      TRANSLATE(ENCODE(gen_random_bytes(8), 'base64'), '/+=', 'ABC')
      FROM 1 FOR 6
    )
  );

COMMENT ON COLUMN public.agents.agent_code IS
  'Public 6-character alphanumeric slug used for agent referrals.';

