-- Migration Rollback: Remove fast delivery configuration settings
-- Description: Removes all fast delivery related configurations

DELETE FROM public.application_configurations
WHERE config_key IN (
    'fast_delivery_fee',
    'fast_delivery_time_hours',
    'fast_delivery_min_hours',
    'fast_delivery_hours',
    'fast_delivery_enabled'
)
AND country_code = 'GA';

