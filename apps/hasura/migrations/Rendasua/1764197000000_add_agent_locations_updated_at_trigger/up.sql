-- Add trigger to automatically update updated_at column on agent_locations table
-- The trigger function already exists from other migrations

-- Create trigger for updated_at column.
-- 1764196194000 also creates this trigger (it was added there after that migration had been
-- applied), so on a fresh database CREATE TRIGGER would fail with "already exists". Drop first:
-- environments that already applied this migration never re-run it, so nothing changes there.
DROP TRIGGER IF EXISTS set_public_agent_locations_updated_at ON public.agent_locations;
CREATE TRIGGER set_public_agent_locations_updated_at
    BEFORE UPDATE ON public.agent_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_agent_locations_updated_at ON public.agent_locations
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';

