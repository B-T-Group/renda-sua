-- Migration: create_delivery_configs_enum
-- Description: Create enum table for delivery configuration keys

-- Create delivery_configs enum table
CREATE TABLE public.delivery_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for config_key lookups
CREATE INDEX idx_delivery_configs_key ON public.delivery_configs(config_key);

-- Create trigger for updated_at
CREATE TRIGGER update_delivery_configs_updated_at
    BEFORE UPDATE ON public.delivery_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert enum values
INSERT INTO public.delivery_configs (config_key, description) VALUES
    ('normal_delivery_base_fee', 'Base fee for standard delivery service'),
    ('fast_delivery_base_fee', 'Base fee for fast delivery service'),
    ('per_km_delivery_fee', 'Fee per kilometer for delivery distance'),
    ('fast_delivery_sla', 'Maximum amount of time (in hours) for fast delivery to reach the client'),
    ('fast_delivery_service_hours', 'Operating hours configuration for fast delivery service by day'),
    ('fast_delivery_enabled', 'Feature flag to enable/disable fast delivery'),
    ('currency', 'Currency code for delivery fees');

-- Add comments
COMMENT ON TABLE public.delivery_configs IS 'Enum table defining available delivery configuration keys';
COMMENT ON COLUMN public.delivery_configs.config_key IS 'Unique identifier for the delivery configuration type';

