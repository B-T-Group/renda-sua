-- Add trigger to automatically update updated_at column on agent_locations table
-- The trigger function already exists from other migrations

-- Create trigger for updated_at column
CREATE TRIGGER set_public_agent_locations_updated_at
    BEFORE UPDATE ON public.agent_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_agent_locations_updated_at ON public.agent_locations
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';

