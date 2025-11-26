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

