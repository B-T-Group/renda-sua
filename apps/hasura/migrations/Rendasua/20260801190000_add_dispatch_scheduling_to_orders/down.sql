DROP INDEX IF EXISTS public.idx_orders_dispatch_ready;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS dispatch_ready_at,
  DROP COLUMN IF EXISTS pickup_by,
  DROP COLUMN IF EXISTS dispatch_round,
  DROP COLUMN IF EXISTS dispatch_exhausted_at;
