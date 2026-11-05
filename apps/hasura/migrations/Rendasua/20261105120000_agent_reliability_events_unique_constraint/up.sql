-- Hasura on_conflict only accepts UNIQUE CONSTRAINTS (pg_constraint), not UNIQUE
-- INDEXES. 20261104200000 created agent_reliability_events_once_idx as a unique
-- index, so insert_agent_reliability_events_one(... on_conflict: {
-- constraint: agent_reliability_events_once_idx }) failed with
-- "constraint \"agent_reliability_events_once_idx\" does not exist". recordReliability
-- swallowed that as a warn, so late_release / reminder_unconfirmed / no_show rows
-- were never written (S6 DEV QA 2026-11-05).
--
-- Convert the existing unique index into a real UNIQUE CONSTRAINT with the same
-- name so the Nest mutation keeps working without a GraphQL enum rename.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'agent_reliability_events_once_idx'
       AND n.nspname = 'public'
       AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'agent_reliability_events_once_idx'
       AND conrelid = 'public.agent_reliability_events'::regclass
  ) THEN
    ALTER TABLE public.agent_reliability_events
      ADD CONSTRAINT agent_reliability_events_once_idx
      UNIQUE USING INDEX agent_reliability_events_once_idx;
  ELSIF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'agent_reliability_events_once_idx'
       AND conrelid = 'public.agent_reliability_events'::regclass
  ) THEN
    -- Fresh / drifted DBs with neither index nor constraint.
    ALTER TABLE public.agent_reliability_events
      ADD CONSTRAINT agent_reliability_events_once_idx
      UNIQUE (agent_id, order_id, kind);
  END IF;
END $$;

COMMENT ON CONSTRAINT agent_reliability_events_once_idx ON public.agent_reliability_events IS
  'One reliability row per (agent, order, kind); Hasura on_conflict target for Nest recordReliability.';
