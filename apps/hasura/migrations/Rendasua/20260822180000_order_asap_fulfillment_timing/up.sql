-- ASAP vs scheduled fulfillment timing and system-computed promise timestamps.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_timing text,
  ADD COLUMN IF NOT EXISTS promised_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS promised_fulfill_by timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_timing_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_timing_check
  CHECK (
    fulfillment_timing IS NULL
    OR fulfillment_timing IN ('asap', 'scheduled')
  );

COMMENT ON COLUMN public.orders.fulfillment_timing IS
  'asap = fulfill as soon as possible (no client slot); scheduled = client picked a delivery/pickup slot; null = shipping / not applicable.';
COMMENT ON COLUMN public.orders.promised_ready_at IS
  'When the merchant should have the order ready (prep complete).';
COMMENT ON COLUMN public.orders.promised_fulfill_by IS
  'Client-facing end of the fulfillment promise (delivery ETA upper bound or pickup-by).';

UPDATE public.orders o
SET fulfillment_timing = 'scheduled'
WHERE o.fulfillment_method IN ('delivery', 'pickup')
  AND o.fulfillment_timing IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.delivery_time_windows w
    WHERE w.order_id = o.id
  );

UPDATE public.orders o
SET fulfillment_timing = 'asap'
WHERE o.fulfillment_method IN ('delivery', 'pickup')
  AND o.fulfillment_timing IS NULL;
