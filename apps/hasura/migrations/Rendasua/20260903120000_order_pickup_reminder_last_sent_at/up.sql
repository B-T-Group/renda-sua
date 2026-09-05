-- Track last client store-pickup reminder push for 24h cadence.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_reminder_last_sent_at timestamptz;

COMMENT ON COLUMN public.orders.pickup_reminder_last_sent_at IS
  'When the client was last reminded to collect a store-pickup order.';
