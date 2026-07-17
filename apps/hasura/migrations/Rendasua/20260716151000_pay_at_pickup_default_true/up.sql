-- Pickup is available by default for new items. Preserve existing merchant choices.
ALTER TABLE public.items
  ALTER COLUMN pay_at_pickup_enabled SET DEFAULT true;

COMMENT ON COLUMN public.items.pay_at_pickup_enabled IS
  'When true, clients may choose store pickup (no delivery fee; pay at pickup via business-initiated MoMo, or card authorized at checkout and captured at handoff on the Stripe rail). Default true.';
