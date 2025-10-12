-- Drop state_code column from supported_country_states table
-- This migration removes the state_code column as we're now using state names directly

-- Drop the state_code column
ALTER TABLE public.supported_country_states DROP COLUMN IF EXISTS state_code;

-- Add comment
COMMENT ON TABLE public.supported_country_states IS 'Updated to use state names instead of state codes';
