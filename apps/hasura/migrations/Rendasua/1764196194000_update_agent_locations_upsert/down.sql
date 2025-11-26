-- Revert agent_locations table changes
-- Remove unique index and updated_at column, restore non-unique index

-- Drop unique constraint (this will also drop the associated index)
ALTER TABLE public.agent_locations 
DROP CONSTRAINT IF EXISTS agent_locations_agent_id_key;

-- Recreate non-unique index on agent_id
CREATE INDEX idx_agent_locations_agent_id 
ON public.agent_locations(agent_id);

-- Drop updated_at column
ALTER TABLE public.agent_locations 
DROP COLUMN IF EXISTS updated_at;

