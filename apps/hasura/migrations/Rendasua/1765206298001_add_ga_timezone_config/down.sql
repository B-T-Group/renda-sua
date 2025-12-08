-- Migration: add_ga_timezone_config (rollback)
-- Description: Remove timezone configuration for GA (Gabon) country

-- Remove GA timezone configuration
DELETE FROM public.country_delivery_configs 
WHERE country_code = 'GA' AND config_key = 'timezone';
