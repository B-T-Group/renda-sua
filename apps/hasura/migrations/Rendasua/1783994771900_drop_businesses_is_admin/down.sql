-- Restore businesses.is_admin (defaults false; does not restore prior values).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE public.businesses b
SET is_admin = true
FROM public.user_roles ur
JOIN public.roles r ON r.id = ur.role_id
WHERE ur.user_id = b.user_id
  AND r.key = 'superuser';
