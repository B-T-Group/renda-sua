ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_timing_check;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS fulfillment_timing,
  DROP COLUMN IF EXISTS promised_ready_at,
  DROP COLUMN IF EXISTS promised_fulfill_by;
