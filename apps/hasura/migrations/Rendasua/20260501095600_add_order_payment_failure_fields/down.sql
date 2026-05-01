ALTER TABLE public.orders
  DROP COLUMN IF EXISTS payment_failure_message,
  DROP COLUMN IF EXISTS payment_failed_at;

