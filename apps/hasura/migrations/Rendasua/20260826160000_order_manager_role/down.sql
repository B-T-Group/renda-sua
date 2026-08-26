DELETE FROM public.role_permissions
WHERE role_id IN (SELECT id FROM public.roles WHERE key = 'order_manager');

DELETE FROM public.user_roles
WHERE role_id IN (SELECT id FROM public.roles WHERE key = 'order_manager');

DELETE FROM public.roles WHERE key = 'order_manager';
