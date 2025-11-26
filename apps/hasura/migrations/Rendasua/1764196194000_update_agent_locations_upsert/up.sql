-- Update agent_locations table to support single record per agent with upsert
-- Add updated_at column and unique index on agent_id

-- Add updated_at column
ALTER TABLE public.agent_locations 
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Drop existing non-unique index on agent_id
DROP INDEX IF EXISTS public.idx_agent_locations_agent_id;

-- Create unique constraint on agent_id to enforce one location per agent
-- This will automatically create a unique index and is required for Hasura upsert
ALTER TABLE public.agent_locations 
ADD CONSTRAINT agent_locations_agent_id_key UNIQUE (agent_id);

-- Add comment for updated_at column
COMMENT ON COLUMN public.agent_locations.updated_at IS 
    'Timestamp when this location was last updated';

-- Create or replace the updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at column
CREATE TRIGGER set_public_agent_locations_updated_at
    BEFORE UPDATE ON public.agent_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_agent_locations_updated_at ON public.agent_locations
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';

