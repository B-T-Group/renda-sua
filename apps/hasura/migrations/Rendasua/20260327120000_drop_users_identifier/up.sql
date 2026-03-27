-- Deprecate and remove users.identifier (Auth0 sub was stored here; use JWT x-hasura-user-id + users.id).

DROP INDEX IF EXISTS public.idx_users_identifier;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_identifier_key;

ALTER TABLE public.users DROP COLUMN IF EXISTS identifier;
