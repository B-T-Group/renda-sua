-- Restore (user_id, expo_push_token) uniqueness; cannot restore deleted duplicate rows.

ALTER TABLE public.mobile_push_tokens
  DROP CONSTRAINT IF EXISTS uq_mobile_push_tokens_user_id;

ALTER TABLE public.mobile_push_tokens
  ADD CONSTRAINT uq_mobile_push_tokens_user_token UNIQUE (user_id, expo_push_token);

COMMENT ON TABLE public.mobile_push_tokens IS
  'Expo push tokens for sending native/mobile push notifications';
