CREATE TYPE public.user_account_status_enum AS ENUM ('active', 'deleted');

ALTER TABLE public.users
  ADD COLUMN account_status public.user_account_status_enum NOT NULL DEFAULT 'active',
  ADD COLUMN deleted_at TIMESTAMPTZ NULL;

CREATE INDEX idx_users_account_status ON public.users (account_status);

COMMENT ON COLUMN public.users.account_status IS 'active = normal account; deleted = anonymized, login blocked';
COMMENT ON COLUMN public.users.deleted_at IS 'When the account was deleted in-app';
