ALTER TABLE public.orders
  DROP COLUMN IF EXISTS eat_in_unavailable,
  DROP COLUMN IF EXISTS eat_in;
