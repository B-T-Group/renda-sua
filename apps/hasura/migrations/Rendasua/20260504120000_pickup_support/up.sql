-- Pickup at business location: item flag, order fulfillment + pay-at-pickup timing, nullable delivery address for pickup orders

-- 1) Item-level: allow clients to choose pickup checkout when true
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS pay_at_pickup_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.items.pay_at_pickup_enabled IS
  'When true, clients may choose store pickup (no delivery fee; pay at pickup via business-initiated MoMo). Default false.';

-- 2) Extend payment timing enum (idempotent add)
DO $$
BEGIN
  ALTER TYPE public.order_payment_timing_enum ADD VALUE 'pay_at_pickup';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

-- 3) Order fulfillment: delivery (default) vs client pickup at business location
DO $$
BEGIN
  CREATE TYPE public.order_fulfillment_method_enum AS ENUM ('delivery', 'pickup');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method public.order_fulfillment_method_enum NOT NULL DEFAULT 'delivery';

COMMENT ON COLUMN public.orders.fulfillment_method IS
  'delivery: ship to client address; pickup: client collects at business_location (no delivery address required).';

-- 4) Pickup orders may omit a client delivery address
ALTER TABLE public.orders
  ALTER COLUMN delivery_address_id DROP NOT NULL;
