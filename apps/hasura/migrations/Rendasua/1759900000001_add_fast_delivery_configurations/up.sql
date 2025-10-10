-- Migration: Add fast delivery configuration settings
-- Description: Adds application configurations for fast delivery fees and timing

-- Fast delivery fee for Gabon (XAF)
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    number_value,
    country_code,
    status,
    tags
) VALUES (
    'fast_delivery_fee',
    'Fast Delivery Fee',
    'Additional fee charged for fast delivery orders (2-4 hour delivery)',
    'currency',
    2000.00,  -- 2000 XAF (~$3.30 USD)
    'GA',     -- Gabon
    'active',
    ARRAY['delivery', 'fees', 'fast-delivery', 'pricing']
)
ON CONFLICT (config_key, country_code) DO UPDATE SET
    number_value = EXCLUDED.number_value,
    updated_at = NOW();

-- Fast delivery time window (in hours)
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    number_value,
    country_code,
    status,
    tags,
    validation_rules,
    min_value,
    max_value
) VALUES (
    'fast_delivery_time_hours',
    'Fast Delivery Time Window',
    'Maximum delivery time for fast delivery orders (in hours)',
    'number',
    4,  -- 4 hours
    'GA',
    'active',
    ARRAY['delivery', 'timing', 'fast-delivery', 'sla'],
    '{"min": 1, "max": 12, "description": "Fast delivery must be completed within this timeframe"}'::jsonb,
    1,
    12
)
ON CONFLICT (config_key, country_code) DO UPDATE SET
    number_value = EXCLUDED.number_value,
    updated_at = NOW();

-- Minimum fast delivery time (to avoid unrealistic expectations)
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    number_value,
    country_code,
    status,
    tags,
    validation_rules
) VALUES (
    'fast_delivery_min_hours',
    'Fast Delivery Minimum Time',
    'Minimum estimated delivery time for fast delivery orders (in hours)',
    'number',
    2,  -- 2 hours minimum
    'GA',
    'active',
    ARRAY['delivery', 'timing', 'fast-delivery', 'sla'],
    '{"min": 0.5, "max": 4, "description": "Minimum time to realistically fulfill fast delivery"}'::jsonb
)
ON CONFLICT (config_key, country_code) DO UPDATE SET
    number_value = EXCLUDED.number_value,
    updated_at = NOW();

-- Fast delivery availability hours (optional - for future use)
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    json_value,
    country_code,
    status,
    tags
) VALUES (
    'fast_delivery_hours',
    'Fast Delivery Service Hours',
    'Operating hours for fast delivery service',
    'json',
    '{
        "monday": {"start": "08:00", "end": "20:00", "enabled": true},
        "tuesday": {"start": "08:00", "end": "20:00", "enabled": true},
        "wednesday": {"start": "08:00", "end": "20:00", "enabled": true},
        "thursday": {"start": "08:00", "end": "20:00", "enabled": true},
        "friday": {"start": "08:00", "end": "20:00", "enabled": true},
        "saturday": {"start": "09:00", "end": "18:00", "enabled": true},
        "sunday": {"start": "10:00", "end": "16:00", "enabled": false}
    }'::jsonb,
    'GA',
    'active',
    ARRAY['delivery', 'timing', 'fast-delivery', 'schedule']
)
ON CONFLICT (config_key, country_code) DO UPDATE SET
    json_value = EXCLUDED.json_value,
    updated_at = NOW();

-- Fast delivery enabled flag (to enable/disable feature globally)
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    boolean_value,
    country_code,
    status,
    tags
) VALUES (
    'fast_delivery_enabled',
    'Fast Delivery Service Enabled',
    'Enable or disable fast delivery service globally',
    'boolean',
    true,  -- Enabled by default
    'GA',
    'active',
    ARRAY['delivery', 'fast-delivery', 'feature-flag']
)
ON CONFLICT (config_key, country_code) DO UPDATE SET
    boolean_value = EXCLUDED.boolean_value,
    updated_at = NOW();

-- Add comment
COMMENT ON TABLE public.application_configurations IS 
'Global application configuration settings including fast delivery parameters';

