DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_locations_agent_id_key'
      AND conrelid = 'public.agent_locations'::regclass
  ) THEN
    ALTER TABLE public.agent_locations
    ADD CONSTRAINT agent_locations_agent_id_key UNIQUE (agent_id);
  END IF;
END $$;
