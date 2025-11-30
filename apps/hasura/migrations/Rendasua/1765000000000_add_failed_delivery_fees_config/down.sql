-- Migration: add_failed_delivery_fees_config (rollback)
-- Description: Remove failed_delivery_fees configuration

-- Remove country_delivery_config for GA
DELETE FROM public.country_delivery_configs
WHERE country_code = 'GA' AND config_key = 'failed_delivery_fees';

-- Remove failed_delivery_fees from delivery_configs
DELETE FROM public.delivery_configs
WHERE config_key = 'failed_delivery_fees';

