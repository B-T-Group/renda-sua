-- Order manager: staff who work the at-risk order queue without full admin rights.
-- Mapped only to platform.orders.cross_business, which already gates
-- AdminOrdersController and the /admin/orders dashboard entry.

INSERT INTO public.roles (key, name, description, is_system)
VALUES (
  'order_manager',
  'Order manager',
  'Works the at-risk order queue and contacts order participants',
  true
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'order_manager'
  AND p.key = 'platform.orders.cross_business'
ON CONFLICT (role_id, permission_id) DO NOTHING;
