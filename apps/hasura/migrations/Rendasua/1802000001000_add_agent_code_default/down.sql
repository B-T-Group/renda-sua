-- Rollback: 1802000001000_add_agent_code_default

ALTER TABLE public.agents
  ALTER COLUMN agent_code DROP DEFAULT;

