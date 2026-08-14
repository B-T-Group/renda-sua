DELETE FROM public.application_configurations
WHERE config_key = 'location_delegations';

DROP TABLE IF EXISTS public.location_delegation_events;
DROP TABLE IF EXISTS public.location_delegations;
DROP TABLE IF EXISTS public.location_delegation_invites;
DROP TABLE IF EXISTS public.location_delegation_role_permissions;
DROP TABLE IF EXISTS public.location_delegation_roles;
DROP TABLE IF EXISTS public.location_delegation_permissions;

DROP TYPE IF EXISTS public.location_delegation_event_type;
DROP TYPE IF EXISTS public.location_delegation_status;
DROP TYPE IF EXISTS public.location_delegation_invite_status;

DELETE FROM public.user_types WHERE id = 'user';
