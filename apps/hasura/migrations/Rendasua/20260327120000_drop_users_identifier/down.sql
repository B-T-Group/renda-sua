-- Partial rollback: column restored without repopulating values.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS identifier text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identifier ON public.users (identifier);
