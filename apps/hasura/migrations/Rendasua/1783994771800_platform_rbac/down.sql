DELETE FROM public.user_permissions;
DELETE FROM public.user_roles;
DELETE FROM public.role_permissions;
DELETE FROM public.roles;
DELETE FROM public.permissions;

DROP TABLE IF EXISTS public.user_permissions;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.permissions;
DROP TYPE IF EXISTS public.permission_effect;
