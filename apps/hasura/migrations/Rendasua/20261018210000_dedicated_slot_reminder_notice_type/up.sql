-- #594 PR 6 (AC-A8): in-app notice type of the day-of dedicated slot reminder to agents.
-- Entity type 'dedicated_agent_assignment' already exists (PR 3). Reference row only: safe to re-run.
INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_SLOT_REMINDER', 'Day-of reminder to a dedicated agent: scheduled orders at the store in their slot')
ON CONFLICT (id) DO NOTHING;
