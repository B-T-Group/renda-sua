-- Pickup is available by default; merchants can still disable it per item.
ALTER TABLE public.items
  ALTER COLUMN pay_at_pickup_enabled SET DEFAULT true;

UPDATE public.items
SET pay_at_pickup_enabled = true
WHERE pay_at_pickup_enabled = false;

COMMENT ON COLUMN public.items.pay_at_pickup_enabled IS
  'When true, clients may choose store pickup (no delivery fee; pay at pickup via business-initiated MoMo, or card authorized at checkout and captured at handoff on the Stripe rail). Default true.';
