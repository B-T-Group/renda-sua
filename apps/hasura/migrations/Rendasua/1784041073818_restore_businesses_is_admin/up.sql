-- Temporarily restore businesses.is_admin for backward-compatible GraphQL clients.
-- Prefer user_roles.superuser for authorization; this column is compatibility-only.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.businesses.is_admin IS
  'Legacy flag kept for older clients. Prefer user_roles.superuser for admin access.';

UPDATE public.businesses b
SET is_admin = true
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = b.user_id
  AND r.key = 'superuser';
