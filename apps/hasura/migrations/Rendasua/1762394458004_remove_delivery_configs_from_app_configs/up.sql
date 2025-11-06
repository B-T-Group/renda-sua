-- Migration: remove_delivery_configs_from_app_configs
-- Description: Remove delivery-related configurations from application_configurations table for GA

-- Delete delivery-related configurations for GA (Gabon)
DELETE FROM public.application_configurations
WHERE country_code = 'GA' 
AND config_key IN (
    'flat_delivery_fees',
    'base_delivery_fee',
    'delivery_fee_rate_per_km',
    'delivery_fee_min',
    'fast_delivery_fee',
    'fast_delivery_time_hours',
    'fast_delivery_min_hours',
    'fast_delivery_hours',
    'fast_delivery_enabled'
);

