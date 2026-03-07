-- Add preferred language for app UI (default fr, allowed en and fr)
ALTER TABLE public.users ADD COLUMN preferred_language VARCHAR(5) NOT NULL DEFAULT 'fr';

ALTER TABLE public.users ADD CONSTRAINT users_preferred_language_check CHECK (preferred_language IN ('en', 'fr'));

COMMENT ON COLUMN public.users.preferred_language IS 'User preferred UI language: en or fr';
