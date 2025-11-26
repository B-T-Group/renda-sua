-- Remove trigger for updated_at column
DROP TRIGGER IF EXISTS set_public_agent_locations_updated_at ON public.agent_locations;

