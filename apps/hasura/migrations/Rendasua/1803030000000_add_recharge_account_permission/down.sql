DELETE FROM public.role_permissions
WHERE permission_id = (SELECT id FROM public.permissions WHERE key = 'platform.financial.recharge_account');

DELETE FROM public.permissions WHERE key = 'platform.financial.recharge_account';
