-- Migration: add_timezone_to_delivery_configs
-- Description: Add timezone configuration key to delivery_configs table

-- Insert timezone enum value
INSERT INTO public.delivery_configs (config_key, description) VALUES
    ('timezone', 'Timezone for delivery operations (IANA timezone identifier, e.g., Africa/Libreville)')
ON CONFLICT (config_key) DO NOTHING;

-- Add comment
COMMENT ON COLUMN public.delivery_configs.config_key IS 'Unique identifier for the delivery configuration type';
