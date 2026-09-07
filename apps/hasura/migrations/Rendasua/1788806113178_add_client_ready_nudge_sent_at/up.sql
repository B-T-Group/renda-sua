-- One-time client "is my order ready?" nudge to the business.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_ready_nudge_sent_at timestamptz;

COMMENT ON COLUMN public.orders.client_ready_nudge_sent_at IS
  'When the client last asked the business if this order is ready for pickup.';
