-- Migration: 1758329400000_add_cancellation_fee_configuration_ga
-- Description: Add cancellation fee configuration for Gabon (GA)

-- Insert cancellation fee configuration for Gabon
INSERT INTO public.application_configurations (
    config_key, 
    config_name, 
    description, 
    data_type, 
    number_value, 
    country_code, 
    tags, 
    status
) VALUES (
    'cancellation_fee', 
    'Cancellation Fee (Gabon)', 
    'Fee charged when an order is cancelled in Gabon', 
    'number', 
    500.00, 
    'GA', 
    ARRAY['cancellation', 'order'], 
    'active'
);
