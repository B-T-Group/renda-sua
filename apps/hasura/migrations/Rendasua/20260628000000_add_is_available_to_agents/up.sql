-- Add is_available column to agents table
-- Tracks whether the agent is available to receive new orders and nearby-order
-- notifications. Defaults to true so existing agents stay available.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.agents.is_available IS 'Whether the agent is available for new orders; when false the agent is not notified of nearby orders';
