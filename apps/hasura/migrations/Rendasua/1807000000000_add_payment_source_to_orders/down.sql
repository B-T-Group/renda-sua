ALTER TABLE public.orders
  DROP COLUMN IF EXISTS payment_source;

DROP TYPE IF EXISTS public.payment_source_enum;
