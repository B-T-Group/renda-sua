ALTER TABLE public.orders
  DROP COLUMN IF EXISTS client_ready_nudge_sent_at;
