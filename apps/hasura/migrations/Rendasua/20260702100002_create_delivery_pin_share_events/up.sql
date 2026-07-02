CREATE TABLE public.delivery_pin_share_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.user_messages(id) ON DELETE CASCADE,
  shared_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shared_to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pin_version int NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pin_share_order ON public.delivery_pin_share_events (order_id, created_at DESC);
CREATE INDEX idx_pin_share_message ON public.delivery_pin_share_events (message_id);
