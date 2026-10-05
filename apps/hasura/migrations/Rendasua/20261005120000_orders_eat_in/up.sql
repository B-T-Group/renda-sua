-- Informational eat-in request on cooked-food pickup orders.
-- fulfillment_method stays pickup.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS eat_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eat_in_unavailable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.eat_in IS
  'Customer asked for a table. Still a pickup order. Cleared when the kitchen has no table and the customer pays, so the kitchen prepares take-out.';
COMMENT ON COLUMN public.orders.eat_in_unavailable IS
  'Kitchen confirmed there is no table. The customer approves or rejects the post-confirm payment request.';
