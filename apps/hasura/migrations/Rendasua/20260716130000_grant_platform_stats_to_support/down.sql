DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.key = 'support'
  AND p.key = 'platform.dashboard.platform_stats';
