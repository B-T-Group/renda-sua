-- Enable location-scoped business delegation (owners invite location delegates).
UPDATE public.application_configurations
SET boolean_value = true,
    description = 'When enabled, owners can invite location delegates and /users/me returns delegation context.',
    updated_at = NOW()
WHERE config_key = 'location_delegations'
  AND status = 'active';
