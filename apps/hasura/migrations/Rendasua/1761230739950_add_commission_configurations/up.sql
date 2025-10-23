-- Migration: add_commission_configurations
-- Description: Add commission configuration settings to application_configurations

INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    number_value,
    status,
    tags
) VALUES 
(
    'rendasua_item_commission_percentage',
    'RendaSua Item Commission Percentage',
    'Percentage of item price that goes to RendaSua (e.g., 5% means RendaSua takes 5% of item price)',
    'number',
    5.0,
    'active',
    ARRAY['commission', 'item', 'rendasua']
),
(
    'unverified_agent_base_delivery_commission',
    'Unverified Agent Base Delivery Commission',
    'Commission percentage for unverified agents on base delivery fee',
    'number',
    50.0,
    'active',
    ARRAY['commission', 'agent', 'delivery', 'unverified']
),
(
    'verified_agent_base_delivery_commission',
    'Verified Agent Base Delivery Commission',
    'Commission percentage for verified agents on base delivery fee',
    'number',
    0.0,
    'active',
    ARRAY['commission', 'agent', 'delivery', 'verified']
),
(
    'unverified_agent_per_km_delivery_commission',
    'Unverified Agent Per-KM Delivery Commission',
    'Commission percentage for unverified agents on per-km delivery fee',
    'number',
    80.0,
    'active',
    ARRAY['commission', 'agent', 'delivery', 'unverified', 'per_km']
),
(
    'verified_agent_per_km_delivery_commission',
    'Verified Agent Per-KM Delivery Commission',
    'Commission percentage for verified agents on per-km delivery fee',
    'number',
    20.0,
    'active',
    ARRAY['commission', 'agent', 'delivery', 'verified', 'per_km']
);
