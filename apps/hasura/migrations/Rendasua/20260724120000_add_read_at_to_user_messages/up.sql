ALTER TABLE public.user_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_user_messages_read_at
  ON public.user_messages (user_id, read_at)
  WHERE read_at IS NULL;
