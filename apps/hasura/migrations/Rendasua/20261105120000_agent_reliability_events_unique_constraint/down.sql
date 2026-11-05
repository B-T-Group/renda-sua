-- Revert to a plain unique index (pre-fix shape). Drops the constraint first;
-- Postgres keeps the underlying index when dropping a UNIQUE constraint created
-- via USING INDEX only if we recreate the index explicitly.
ALTER TABLE public.agent_reliability_events
  DROP CONSTRAINT IF EXISTS agent_reliability_events_once_idx;
CREATE UNIQUE INDEX IF NOT EXISTS agent_reliability_events_once_idx
  ON public.agent_reliability_events (agent_id, order_id, kind);
