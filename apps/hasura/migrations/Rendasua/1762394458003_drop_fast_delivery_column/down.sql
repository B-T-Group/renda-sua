-- Rollback: Add fast_delivery column back
ALTER TABLE public.supported_country_states
ADD COLUMN fast_delivery JSONB;

COMMENT ON COLUMN public.supported_country_states.fast_delivery IS 'JSON configuration for fast delivery settings including enabled status, fees, timing, and operating hours';

