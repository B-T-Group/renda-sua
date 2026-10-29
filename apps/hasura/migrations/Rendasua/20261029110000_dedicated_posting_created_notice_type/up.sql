-- #594 addendum AC-P13: in-app notice type of the new-posting push to in-city agents
-- preferring all the posting's slots. Entity type 'dedicated_agent_posting' exists (PR 7).
-- Reference row only: safe to re-run.
INSERT INTO public.message_types (id, comment) VALUES
  ('DEDICATED_POSTING_CREATED', 'A store near the agent posted a dedicated agent spot in slots the agent prefers')
ON CONFLICT (id) DO NOTHING;
