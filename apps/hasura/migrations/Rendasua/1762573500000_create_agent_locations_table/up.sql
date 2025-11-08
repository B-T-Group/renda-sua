-- Create agent_locations table
-- This table stores location coordinates (latitude/longitude) for delivery agents
-- Used to track agent locations for order assignment and proximity-based notifications

CREATE TABLE public.agent_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_agent_locations_agent 
        FOREIGN KEY (agent_id) 
        REFERENCES public.agents(id) 
        ON UPDATE RESTRICT 
        ON DELETE CASCADE,
    
    -- Constraints for valid coordinates
    CONSTRAINT agent_locations_latitude_check 
        CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT agent_locations_longitude_check 
        CHECK (longitude >= -180 AND longitude <= 180)
);

-- Create indexes for efficient queries
CREATE INDEX idx_agent_locations_agent_id ON public.agent_locations(agent_id);
CREATE INDEX idx_agent_locations_created_at ON public.agent_locations(created_at DESC);
CREATE INDEX idx_agent_locations_agent_created_at 
    ON public.agent_locations(agent_id, created_at DESC);

-- Add comments
COMMENT ON TABLE public.agent_locations IS 
    'Stores location coordinates for delivery agents, updated periodically for order assignment';
COMMENT ON COLUMN public.agent_locations.agent_id IS 
    'Reference to the agent whose location is being tracked';
COMMENT ON COLUMN public.agent_locations.latitude IS 
    'Latitude coordinate (-90 to 90)';
COMMENT ON COLUMN public.agent_locations.longitude IS 
    'Longitude coordinate (-180 to 180)';
COMMENT ON COLUMN public.agent_locations.created_at IS 
    'Timestamp when this location was recorded';

