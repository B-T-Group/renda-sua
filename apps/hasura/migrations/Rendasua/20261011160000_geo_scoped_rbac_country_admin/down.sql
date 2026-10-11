DELETE FROM public.role_permissions
WHERE role_id IN (SELECT id FROM public.roles WHERE key = 'country_admin');

DELETE FROM public.user_roles
WHERE role_id IN (SELECT id FROM public.roles WHERE key = 'country_admin');

DELETE FROM public.roles WHERE key = 'country_admin';

DELETE FROM public.permissions
WHERE key IN ('platform.users.read', 'platform.ops.map');

UPDATE public.permissions
SET geo_scopable = false
WHERE key IN ('platform.orders.cross_business', 'platform.ops.credits');

ALTER TABLE public.roles DROP COLUMN IF EXISTS requires_geo_scope;
ALTER TABLE public.permissions DROP COLUMN IF EXISTS geo_scopable;

DROP TRIGGER IF EXISTS user_roles_assert_state_country ON public.user_roles;
DROP FUNCTION IF EXISTS public.user_roles_assert_state_country();

DROP INDEX IF EXISTS user_roles_country_code_idx;
DROP INDEX IF EXISTS user_roles_state_unique;
DROP INDEX IF EXISTS user_roles_country_unique;
DROP INDEX IF EXISTS user_roles_global_unique;

DELETE FROM public.user_roles
WHERE country_code IS NOT NULL OR supported_country_state_id IS NOT NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_state_requires_country;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS supported_country_state_id;
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS country_code;
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS id;
ALTER TABLE public.user_roles ADD PRIMARY KEY (user_id, role_id);

DROP INDEX IF EXISTS supported_country_states_state_key_idx;
DROP INDEX IF EXISTS addresses_state_key_idx;
ALTER TABLE public.supported_country_states DROP COLUMN IF EXISTS state_key;
ALTER TABLE public.addresses DROP COLUMN IF EXISTS state_key;
DROP FUNCTION IF EXISTS public.geo_state_key(text);
