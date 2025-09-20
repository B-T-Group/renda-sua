-- Remove initial configuration items
DELETE FROM public.application_configurations WHERE config_key IN (
    'default_agent_hold_amount_percentage',
    'flat_delivery_fees',
    'base_delivery_fee',
    'delivery_fee_rate_per_km',
    'delivery_fee_min'
);
