-- Migration: add_timezone_to_delivery_configs (rollback)
-- Description: Remove timezone configuration key from delivery_configs table

-- Remove timezone config key (this will cascade delete country_delivery_configs entries)
DELETE FROM public.delivery_configs WHERE config_key = 'timezone';
