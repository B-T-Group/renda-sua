-- Grant platform.dashboard.platform_stats to the support role so ops can
-- use the admin performance dashboard (superusers already pass implicitly).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'support'
  AND p.key = 'platform.dashboard.platform_stats'
ON CONFLICT DO NOTHING;
