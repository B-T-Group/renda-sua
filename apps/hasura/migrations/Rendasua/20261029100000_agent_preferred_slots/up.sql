-- #594 addendum PR1: agent preferred delivery slots (AC-P1) and assignment pause reason (AC-P4).
-- P1: every agent prefers all three slots; ADD COLUMN ... DEFAULT true NOT NULL backfills existing rows.
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS pref_morning boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_afternoon boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_evening boolean NOT NULL DEFAULT true;

-- Explicit backfill (no-op after the defaulted ADD COLUMN, kept for re-runs on partially applied DBs).
UPDATE public.agents
   SET pref_morning = true, pref_afternoon = true, pref_evening = true
 WHERE pref_morning IS DISTINCT FROM true
    OR pref_afternoon IS DISTINCT FROM true
    OR pref_evening IS DISTINCT FROM true;

-- Why an assignment is paused. NULL = legacy / not paused.
ALTER TABLE public.dedicated_agent_assignments
  ADD COLUMN IF NOT EXISTS pause_reason text;

ALTER TABLE public.dedicated_agent_assignments
  DROP CONSTRAINT IF EXISTS dedicated_agent_assignments_pause_reason_check;
ALTER TABLE public.dedicated_agent_assignments
  ADD CONSTRAINT dedicated_agent_assignments_pause_reason_check CHECK (
    pause_reason IS NULL
    OR pause_reason IN ('paused_slot_off', 'paused_business', 'paused_admin', 'paused_store_slot_disabled')
  );

COMMENT ON COLUMN public.agents.pref_morning IS '#594 addendum: agent prefers the morning slot (store-local hours)';
COMMENT ON COLUMN public.agents.pref_afternoon IS '#594 addendum: agent prefers the afternoon slot (store-local hours)';
COMMENT ON COLUMN public.agents.pref_evening IS '#594 addendum: agent prefers the evening slot (store-local hours)';
COMMENT ON COLUMN public.dedicated_agent_assignments.pause_reason IS
  '#594 addendum: paused_slot_off (agent turned the slot pref off) | paused_business | paused_admin | paused_store_slot_disabled';
