-- Insert initial configuration items

-- Default agent hold amount percentage (global)
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type, number_value, 
    tags, status
) VALUES (
    'default_agent_hold_amount_percentage', 'Default Agent Hold Amount Percentage', 
    'Default percentage of agent earnings to hold as security deposit', 
    'number', 80.00, ARRAY['agents', 'payments', 'hold_amount'], 'active'
);

-- Flat delivery fees by country
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type, number_value, 
    country_code, tags, status
) VALUES 
    ('flat_delivery_fees', 'Flat Delivery Fees (Gabon)', 'Flat delivery fee for Gabon', 'number', 1500.00, 'GA', ARRAY['delivery', 'pricing', 'flat_fee'], 'active'),
    ('flat_delivery_fees', 'Flat Delivery Fees (Cameroon)', 'Flat delivery fee for Cameroon', 'number', 1500.00, 'CM', ARRAY['delivery', 'pricing', 'flat_fee'], 'active'),
    ('flat_delivery_fees', 'Flat Delivery Fees (Canada)', 'Flat delivery fee for Canada', 'number', 10.00, 'CA', ARRAY['delivery', 'pricing', 'flat_fee'], 'active'),
    ('flat_delivery_fees', 'Flat Delivery Fees (USA)', 'Flat delivery fee for United States', 'number', 10.00, 'US', ARRAY['delivery', 'pricing', 'flat_fee'], 'active');

-- Base delivery fees by country
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type, number_value, 
    country_code, tags, status
) VALUES 
    ('base_delivery_fee', 'Base Delivery Fee (Gabon)', 'Base delivery fee for Gabon', 'number', 300.00, 'GA', ARRAY['delivery', 'pricing', 'base_fee'], 'active'),
    ('base_delivery_fee', 'Base Delivery Fee (Cameroon)', 'Base delivery fee for Cameroon', 'number', 300.00, 'CM', ARRAY['delivery', 'pricing', 'base_fee'], 'active'),
    ('base_delivery_fee', 'Base Delivery Fee (Canada)', 'Base delivery fee for Canada', 'number', 1.00, 'CA', ARRAY['delivery', 'pricing', 'base_fee'], 'active'),
    ('base_delivery_fee', 'Base Delivery Fee (USA)', 'Base delivery fee for United States', 'number', 1.50, 'US', ARRAY['delivery', 'pricing', 'base_fee'], 'active');

-- Delivery fee rates per km by country
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type, number_value, 
    country_code, tags, status
) VALUES 
    ('delivery_fee_rate_per_km', 'Delivery Fee Rate Per KM (Gabon)', 'Rate per kilometer for delivery in Gabon', 'number', 200.00, 'GA', ARRAY['delivery', 'pricing', 'rate_per_km'], 'active'),
    ('delivery_fee_rate_per_km', 'Delivery Fee Rate Per KM (Cameroon)', 'Rate per kilometer for delivery in Cameroon', 'number', 200.00, 'CM', ARRAY['delivery', 'pricing', 'rate_per_km'], 'active'),
    ('delivery_fee_rate_per_km', 'Delivery Fee Rate Per KM (Canada)', 'Rate per kilometer for delivery in Canada', 'number', 0.75, 'CA', ARRAY['delivery', 'pricing', 'rate_per_km'], 'active'),
    ('delivery_fee_rate_per_km', 'Delivery Fee Rate Per KM (USA)', 'Rate per kilometer for delivery in United States', 'number', 0.50, 'US', ARRAY['delivery', 'pricing', 'rate_per_km'], 'active');

-- Minimum delivery fees by country
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type, number_value, 
    country_code, tags, status
) VALUES 
    ('delivery_fee_min', 'Minimum Delivery Fee (Gabon)', 'Minimum delivery fee for Gabon', 'number', 500.00, 'GA', ARRAY['delivery', 'pricing', 'minimum_fee'], 'active'),
    ('delivery_fee_min', 'Minimum Delivery Fee (Cameroon)', 'Minimum delivery fee for Cameroon', 'number', 500.00, 'CM', ARRAY['delivery', 'pricing', 'minimum_fee'], 'active'),
    ('delivery_fee_min', 'Minimum Delivery Fee (Canada)', 'Minimum delivery fee for Canada', 'number', 3.00, 'CA', ARRAY['delivery', 'pricing', 'minimum_fee'], 'active'),
    ('delivery_fee_min', 'Minimum Delivery Fee (USA)', 'Minimum delivery fee for United States', 'number', 2.00, 'US', ARRAY['delivery', 'pricing', 'minimum_fee'], 'active');
