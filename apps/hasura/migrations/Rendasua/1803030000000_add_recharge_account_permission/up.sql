-- Add platform.financial.recharge_account permission for HQ account top-up via mobile money
INSERT INTO public.permissions (key, description, category) VALUES
  ('platform.financial.recharge_account', 'Initiate mobile-money recharge of the Rendasua HQ account', 'finance')
ON CONFLICT (key) DO NOTHING;

-- Grant the permission to the finance role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'finance'
  AND p.key = 'platform.financial.recharge_account'
ON CONFLICT DO NOTHING;
