-- Allow multiple @mentions per message (e.g. client + business on quick messages).
ALTER TABLE public.message_mentions
  DROP CONSTRAINT IF EXISTS message_mentions_message_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS message_mentions_message_user_key
  ON public.message_mentions (message_id, mentioned_user_id);

INSERT INTO public.message_types (id, comment)
VALUES (
  'QUICK_MESSAGE',
  'Catalog-driven structured quick message for order chat (persona + status gated)'
)
ON CONFLICT (id) DO NOTHING;
