-- Drop supported_country_states table
-- This reverses the creation of the supported_country_states table

-- Drop trigger first
DROP TRIGGER IF EXISTS update_supported_country_states_updated_at ON public.supported_country_states;

-- Drop function
DROP FUNCTION IF EXISTS update_supported_country_states_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_supported_country_states_country;
DROP INDEX IF EXISTS idx_supported_country_states_state;
DROP INDEX IF EXISTS idx_supported_country_states_status;
DROP INDEX IF EXISTS idx_supported_country_states_delivery;

-- Drop table
DROP TABLE IF EXISTS public.supported_country_states;
