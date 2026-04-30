DROP INDEX IF EXISTS public.idx_orders_discount_code_id;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS discount_amount,
  DROP COLUMN IF EXISTS discount_code_id;

