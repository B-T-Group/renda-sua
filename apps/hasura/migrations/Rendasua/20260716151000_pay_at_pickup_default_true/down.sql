ALTER TABLE public.items
  ALTER COLUMN pay_at_pickup_enabled SET DEFAULT false;

COMMENT ON COLUMN public.items.pay_at_pickup_enabled IS
  'When true, clients may choose store pickup (no delivery fee; pay at pickup via business-initiated MoMo). Default false.';
