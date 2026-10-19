-- #594 PR 3: in-app notice types for dedicated-agent assignment events (push + user_messages,
-- same pattern as the payment-programme notices). Reference rows only: safe to re-run.
INSERT INTO public.entity_types (id, comment) VALUES
  ('dedicated_agent_assignment', 'Dedicated delivery agent assignment related messages')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_AGENT_ASSIGNED', 'A super user assigned a dedicated agent to a location slot'),
  ('DEDICATED_AGENT_PAUSED', 'A dedicated agent assignment was paused'),
  ('DEDICATED_AGENT_RESUMED', 'A paused dedicated agent assignment was resumed'),
  ('DEDICATED_AGENT_REMOVED', 'A dedicated agent assignment was removed')
ON CONFLICT (id) DO NOTHING;
