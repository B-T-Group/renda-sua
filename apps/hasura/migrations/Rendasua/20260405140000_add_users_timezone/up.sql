-- Add IANA timezone for user display and scheduling preferences

ALTER TABLE public.users
ADD COLUMN timezone text NOT NULL DEFAULT 'Africa/Douala';

COMMENT ON COLUMN public.users.timezone IS 'IANA timezone identifier (e.g. Africa/Douala)';
