DROP INDEX IF EXISTS idx_user_messages_read_at;
ALTER TABLE public.user_messages DROP COLUMN IF EXISTS read_at;
