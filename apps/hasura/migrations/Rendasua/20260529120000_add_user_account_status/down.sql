DROP INDEX IF EXISTS public.idx_users_account_status;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS account_status;

DROP TYPE IF EXISTS public.user_account_status_enum;
