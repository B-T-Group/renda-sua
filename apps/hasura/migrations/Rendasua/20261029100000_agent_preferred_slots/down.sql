ALTER TABLE public.dedicated_agent_assignments
  DROP CONSTRAINT IF EXISTS dedicated_agent_assignments_pause_reason_check;
ALTER TABLE public.dedicated_agent_assignments DROP COLUMN IF EXISTS pause_reason;

ALTER TABLE public.agents
  DROP COLUMN IF EXISTS pref_evening,
  DROP COLUMN IF EXISTS pref_afternoon,
  DROP COLUMN IF EXISTS pref_morning;
