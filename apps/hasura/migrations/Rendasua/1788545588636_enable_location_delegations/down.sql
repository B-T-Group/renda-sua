UPDATE public.application_configurations
SET boolean_value = false,
    description = 'When enabled, owners can invite location delegates and /users/me returns delegation context. Default off.',
    updated_at = NOW()
WHERE config_key = 'location_delegations';
