-- Reverse migration: Add state_code column back to supported_country_states table
-- Note: This will add the column but won't restore the original data

-- Add state_code column back
ALTER TABLE public.supported_country_states 
ADD COLUMN state_code VARCHAR(50);

-- Add comment
COMMENT ON COLUMN public.supported_country_states.state_code IS 'State code (re-added for rollback)';
