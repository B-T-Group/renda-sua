-- Drop legacy businesses.is_admin after RBAC migration (all admins have superuser role).

-- Safety remigration for any leftover rows
INSERT INTO public.user_roles (user_id, role_id)
SELECT b.user_id, r.id
FROM public.businesses b
CROSS JOIN public.roles r
WHERE b.is_admin = true
  AND r.key = 'superuser'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = b.user_id
      AND ur.role_id = r.id
  );

ALTER TABLE public.businesses DROP COLUMN IF EXISTS is_admin;
