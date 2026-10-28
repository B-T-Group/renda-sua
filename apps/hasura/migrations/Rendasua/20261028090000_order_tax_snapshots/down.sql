-- Down: drop the snapshot tables and narrow orders.tax_status back to the original set.
-- Rows already marked 'void' are returned to 'estimated' first so the old check can hold.
SET LOCAL lock_timeout = '5s';

DROP TABLE IF EXISTS public.order_tax_reversals;
DROP TABLE IF EXISTS public.order_tax_snapshots;

UPDATE public.orders SET tax_status = 'estimated' WHERE tax_status = 'void';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_tax_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_tax_status_check
  CHECK (tax_status IN ('none', 'estimated', 'finalized')) NOT VALID;
ALTER TABLE public.orders VALIDATE CONSTRAINT orders_tax_status_check;
