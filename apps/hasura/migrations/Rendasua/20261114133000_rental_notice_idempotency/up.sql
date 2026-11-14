-- One in-app rental notice per booking and event. Null keys stay unconstrained
-- so existing messages are untouched.
ALTER TABLE public.user_messages
  ADD COLUMN IF NOT EXISTS notice_idempotency_key text;

ALTER TABLE public.user_messages
  DROP CONSTRAINT IF EXISTS user_messages_notice_idempotency_key_key;

ALTER TABLE public.user_messages
  ADD CONSTRAINT user_messages_notice_idempotency_key_key UNIQUE (notice_idempotency_key);
