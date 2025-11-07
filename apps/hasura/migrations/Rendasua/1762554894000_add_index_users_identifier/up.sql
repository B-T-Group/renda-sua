-- Add unique index on users.identifier for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_identifier ON public.users(identifier);

-- Add comment
COMMENT ON INDEX idx_users_identifier IS 'Unique index on users.identifier for fast user lookups by identifier';

