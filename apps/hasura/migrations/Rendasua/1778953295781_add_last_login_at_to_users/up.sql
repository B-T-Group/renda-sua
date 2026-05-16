-- Track when the user last authenticated (nullable until first login).

ALTER TABLE public.users
ADD COLUMN last_login_at timestamptz;

COMMENT ON COLUMN public.users.last_login_at IS 'Timestamp of the user''s most recent successful login';
