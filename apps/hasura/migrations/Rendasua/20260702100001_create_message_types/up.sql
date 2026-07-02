CREATE TABLE public.message_types (
  id text PRIMARY KEY,
  comment text NOT NULL
);

INSERT INTO public.message_types (id, comment) VALUES
  ('TEXT', 'Free-form user message'),
  ('DELIVERY_PIN', 'Client-shared delivery PIN for assigned agent'),
  ('SYSTEM', 'System-generated order event'),
  ('PAYMENT', 'Payment status event'),
  ('LOCATION', 'Location share'),
  ('IMAGE', 'Image attachment reference');

ALTER TABLE public.user_messages
  ADD COLUMN message_type text NOT NULL DEFAULT 'TEXT'
    REFERENCES public.message_types(id),
  ADD COLUMN message_payload jsonb,
  ADD COLUMN is_immutable boolean NOT NULL DEFAULT false;

CREATE INDEX idx_user_messages_type_entity
  ON public.user_messages (entity_type, entity_id, message_type, created_at DESC);
