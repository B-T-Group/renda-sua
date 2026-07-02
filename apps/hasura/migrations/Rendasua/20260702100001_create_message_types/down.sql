DROP INDEX IF EXISTS idx_user_messages_type_entity;

ALTER TABLE public.user_messages
  DROP COLUMN IF EXISTS is_immutable,
  DROP COLUMN IF EXISTS message_payload,
  DROP COLUMN IF EXISTS message_type;

DROP TABLE IF EXISTS public.message_types;
