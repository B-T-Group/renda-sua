-- Add status column to agents (active | suspended); default active
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.agents.status IS 'Agent account status: active (default) or suspended (e.g. after 3 strikes in month)';
