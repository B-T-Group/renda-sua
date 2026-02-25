-- Revert: remove hold configs and is_internal
DELETE FROM public.application_configurations
WHERE config_key IN (
    'internal_agent_hold_percentage',
    'verified_agent_hold_percentage',
    'unverified_agent_hold_percentage'
);

ALTER TABLE public.agents
DROP COLUMN IF EXISTS is_internal;

-- Restore legacy config (optional; was 80)
INSERT INTO public.application_configurations (
    config_key, config_name, description, data_type, number_value,
    tags, status
) VALUES (
    'default_agent_hold_amount_percentage', 'Default Agent Hold Amount Percentage',
    'Default percentage of agent earnings to hold as security deposit',
    'number', 80.00, ARRAY['agents', 'payments', 'hold_amount'], 'active'
);
