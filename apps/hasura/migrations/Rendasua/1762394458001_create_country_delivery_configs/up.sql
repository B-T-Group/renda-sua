-- Migration: create_country_delivery_configs
-- Description: Create table for country-specific delivery configurations with GA data

-- Create country_delivery_configs table
CREATE TABLE public.country_delivery_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_value TEXT NOT NULL,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_country_config UNIQUE (country_code, config_key),
    CONSTRAINT fk_delivery_config FOREIGN KEY (config_key) 
        REFERENCES public.delivery_configs(config_key) ON DELETE RESTRICT
);

-- Create indexes for better performance
CREATE INDEX idx_country_delivery_configs_country ON public.country_delivery_configs(country_code);
CREATE INDEX idx_country_delivery_configs_country_key ON public.country_delivery_configs(country_code, config_key);

-- Create trigger for updated_at
CREATE TRIGGER update_country_delivery_configs_updated_at
    BEFORE UPDATE ON public.country_delivery_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.country_delivery_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for all roles (public read access)
CREATE POLICY "Allow public read access" ON public.country_delivery_configs
    FOR SELECT USING (true);

-- Insert GA (Gabon) delivery configurations
INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('GA', 'normal_delivery_base_fee', '1000', 'number'),
    ('GA', 'fast_delivery_base_fee', '1500', 'number'),
    ('GA', 'per_km_delivery_fee', '200', 'number'),
    ('GA', 'fast_delivery_sla', '4', 'number'),
    ('GA', 'fast_delivery_service_hours', '{"friday": {"end": "20:00", "start": "08:00", "enabled": true}, "monday": {"end": "20:00", "start": "08:00", "enabled": true}, "sunday": {"end": "16:00", "start": "10:00", "enabled": false}, "tuesday": {"end": "20:00", "start": "08:00", "enabled": true}, "saturday": {"end": "18:00", "start": "09:00", "enabled": true}, "thursday": {"end": "20:00", "start": "08:00", "enabled": true}, "wednesday": {"end": "20:00", "start": "08:00", "enabled": true}}', 'json'),
    ('GA', 'fast_delivery_enabled', 'true', 'boolean'),
    ('GA', 'currency', 'XAF', 'string');

-- Add comments
COMMENT ON TABLE public.country_delivery_configs IS 'Country-specific delivery configuration values';
COMMENT ON COLUMN public.country_delivery_configs.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., GA, CM)';
COMMENT ON COLUMN public.country_delivery_configs.config_key IS 'Reference to delivery_configs.config_key';
COMMENT ON COLUMN public.country_delivery_configs.config_value IS 'Configuration value stored as text (parse based on data_type)';
COMMENT ON COLUMN public.country_delivery_configs.data_type IS 'Type of the config_value: string, number, boolean, or json';

