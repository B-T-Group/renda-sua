-- Migration: delivery_availability_radius
-- Description: Checkout-time delivery availability radius. Delivery is offered
-- only when at least one eligible agent is within this many km of the business
-- pickup location. Configurable per country (ops band 10-20 km).

INSERT INTO public.delivery_configs (config_key, description) VALUES
    ('delivery_availability_radius_km', 'Max distance in km between the business pickup location and an eligible agent for delivery to be offered at checkout')
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO public.country_delivery_configs (country_code, config_key, config_value, data_type) VALUES
    ('GA', 'delivery_availability_radius_km', '20', 'number'),
    ('CM', 'delivery_availability_radius_km', '20', 'number'),
    ('CA', 'delivery_availability_radius_km', '20', 'number')
ON CONFLICT (country_code, config_key) DO NOTHING;
