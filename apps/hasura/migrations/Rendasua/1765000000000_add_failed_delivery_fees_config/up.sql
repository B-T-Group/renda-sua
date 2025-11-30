-- Migration: add_failed_delivery_fees_config
-- Description: Add failed_delivery_fees configuration for client-fault failed deliveries

-- Insert failed_delivery_fees into delivery_configs table
INSERT INTO public.delivery_configs (config_key, description) VALUES
    ('failed_delivery_fees', 'Fee paid by the client when a delivery fails and the root cause for the failure is the client');

-- Insert country_delivery_config for GA (Gabon) with value 200
INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('GA', 'failed_delivery_fees', '200', 'number');

-- Add comment
COMMENT ON COLUMN public.delivery_configs.config_key IS 'Unique identifier for the delivery configuration type';

