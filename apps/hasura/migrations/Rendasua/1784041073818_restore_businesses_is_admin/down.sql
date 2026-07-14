-- Re-drop temporary businesses.is_admin compatibility column.
ALTER TABLE public.businesses DROP COLUMN IF EXISTS is_admin;
