-- Drop supported_country_states table
-- This reverses the creation of the supported_country_states table

-- Drop trigger first
DROP TRIGGER IF EXISTS update_supported_country_states_updated_at ON public.supported_country_states;

-- Drop indexes
DROP INDEX IF EXISTS idx_supported_country_states_country;
DROP INDEX IF EXISTS idx_supported_country_states_service_status;
DROP INDEX IF EXISTS idx_supported_country_states_delivery_enabled;
DROP INDEX IF EXISTS idx_supported_country_states_country_state;

-- Drop table
DROP TABLE IF EXISTS public.supported_country_states;

