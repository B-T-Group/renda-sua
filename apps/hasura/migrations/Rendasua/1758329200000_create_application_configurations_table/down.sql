DROP TRIGGER IF EXISTS trigger_application_configurations_updated_at ON public.application_configurations;
DROP FUNCTION IF EXISTS update_application_configurations_updated_at();

DROP INDEX IF EXISTS idx_application_configurations_active;
DROP INDEX IF EXISTS idx_application_configurations_status;
DROP INDEX IF EXISTS idx_application_configurations_country;
DROP INDEX IF EXISTS idx_application_configurations_key;

DROP TABLE IF EXISTS public.application_configurations;
