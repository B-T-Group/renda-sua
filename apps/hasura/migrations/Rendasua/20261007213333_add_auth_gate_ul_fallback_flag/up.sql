-- Add auth_gate_ul_fallback flag (defaults true wherever auth_web_inapp_gates is on)
-- Global row: on when auth_web_inapp_gates is on, off otherwise
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    boolean_value,
    country_code,
    status
) VALUES (
    'auth_gate_ul_fallback',
    'Auth Gate Universal Login Fallback',
    'Show "Sign in with password" link to Auth0 Universal Login in the in-app auth gate. Defaults true wherever auth_web_inapp_gates is on.',
    'boolean',
    true,
    NULL,
    'active'
)
WHERE NOT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'auth_gate_ul_fallback' AND country_code IS NULL
);

-- CM row: on to match auth_web_inapp_gates
INSERT INTO public.application_configurations (
    config_key,
    config_name,
    description,
    data_type,
    boolean_value,
    country_code,
    status
) VALUES (
    'auth_gate_ul_fallback',
    'Auth Gate Universal Login Fallback (CM)',
    'Show "Sign in with password" link to Auth0 Universal Login in the in-app auth gate for Cameroon.',
    'boolean',
    true,
    'CM',
    'active'
)
WHERE NOT EXISTS (
    SELECT 1 FROM public.application_configurations
    WHERE config_key = 'auth_gate_ul_fallback' AND country_code = 'CM'
);
