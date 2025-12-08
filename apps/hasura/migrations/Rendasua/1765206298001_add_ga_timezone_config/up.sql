-- Migration: add_ga_timezone_config
-- Description: Add timezone configuration for GA (Gabon) country

-- Insert GA timezone configuration
INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('GA', 'timezone', 'Africa/Libreville', 'string')
ON CONFLICT (country_code, config_key) DO UPDATE
SET config_value = EXCLUDED.config_value,
    data_type = EXCLUDED.data_type,
    updated_at = NOW();
