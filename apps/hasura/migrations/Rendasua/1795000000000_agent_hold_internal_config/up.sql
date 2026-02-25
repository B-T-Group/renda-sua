-- Migration: agent_hold_internal_config
-- Description: Add is_internal to agents; add hold percentage configs (internal 0, verified 80, unverified 100); remove default_agent_hold_amount_percentage

-- Add is_internal column to agents table
ALTER TABLE public.agents
ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.agents.is_internal IS 'Agent works for Rendasua; hold percentage is 0 and required for high-value orders';

-- Remove legacy single hold percentage config
DELETE FROM public.application_configurations
WHERE config_key = 'default_agent_hold_amount_percentage';

-- Insert three hold percentage configs
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
    'internal_agent_hold_percentage',
    'Internal Agent Hold Percentage',
    'Hold percentage for internal (Rendasua) agents; always 0',
    'number',
    0,
    'active',
    ARRAY['agent', 'hold', 'internal']
),
(
    'verified_agent_hold_percentage',
    'Verified Agent Hold Percentage',
    'Hold percentage for verified agents (credentials verified)',
    'number',
    80,
    'active',
    ARRAY['agent', 'hold', 'verified']
),
(
    'unverified_agent_hold_percentage',
    'Unverified Agent Hold Percentage',
    'Hold percentage for unverified agents',
    'number',
    100,
    'active',
    ARRAY['agent', 'hold', 'unverified']
);
