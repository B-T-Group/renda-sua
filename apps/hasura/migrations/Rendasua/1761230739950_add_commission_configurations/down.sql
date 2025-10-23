-- Migration: add_commission_configurations (rollback)
-- Description: Remove commission configuration settings

DELETE FROM public.application_configurations 
WHERE config_key IN (
    'rendasua_item_commission_percentage',
    'unverified_agent_base_delivery_commission',
    'verified_agent_base_delivery_commission',
    'unverified_agent_per_km_delivery_commission',
    'verified_agent_per_km_delivery_commission'
);
