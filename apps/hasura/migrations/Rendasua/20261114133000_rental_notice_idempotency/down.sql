ALTER TABLE public.user_messages
  DROP CONSTRAINT IF EXISTS user_messages_notice_idempotency_key_key;

ALTER TABLE public.user_messages
  DROP COLUMN IF EXISTS notice_idempotency_key;
