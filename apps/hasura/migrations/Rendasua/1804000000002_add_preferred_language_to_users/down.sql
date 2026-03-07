ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_preferred_language_check;

ALTER TABLE public.users DROP COLUMN IF EXISTS preferred_language;
