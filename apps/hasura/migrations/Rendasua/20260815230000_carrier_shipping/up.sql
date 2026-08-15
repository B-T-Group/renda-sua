-- Carrier shipping: add shipping fulfillment method, item shipping fields, order tracking fields, and shipping statuses

-- 1) Extend order_fulfillment_method_enum to include 'shipping'
DO $$
BEGIN
  ALTER TYPE public.order_fulfillment_method_enum ADD VALUE 'shipping';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

COMMENT ON TYPE public.order_fulfillment_method_enum IS
  'delivery: agent-based local delivery; pickup: client collects at business_location; shipping: carrier-based shipping with tracking.';

-- 2) Add shipping fields to items table
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS shipping_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS shipping_currency varchar(3) DEFAULT 'XAF';

COMMENT ON COLUMN public.items.shipping_enabled IS
  'When true, this item can be shipped via carrier (fulfillment_method = shipping). Default false.';

COMMENT ON COLUMN public.items.shipping_price IS
  'Cost to ship this item via carrier. Required when shipping_enabled is true. Currency matches shipping_currency.';

COMMENT ON COLUMN public.items.shipping_currency IS
  'Currency for shipping_price. Defaults to XAF.';

-- Add constraint: shipping_price must be >= 0 when set
ALTER TABLE public.items
  ADD CONSTRAINT items_shipping_price_non_negative
  CHECK (shipping_price IS NULL OR shipping_price >= 0);

-- 3) Add shipping tracking fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_tracking_number varchar(100),
  ADD COLUMN IF NOT EXISTS shipping_carrier varchar(50),
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

COMMENT ON COLUMN public.orders.shipping_tracking_number IS
  'Tracking number provided by carrier when order is shipped. Optional but recommended.';

COMMENT ON COLUMN public.orders.shipping_carrier IS
  'Name of shipping carrier (e.g., DHL, FedEx, local courier). Optional.';

COMMENT ON COLUMN public.orders.shipped_at IS
  'Timestamp when business marked order as shipped and handed to carrier.';

COMMENT ON COLUMN public.orders.received_at IS
  'Timestamp when client confirmed receipt of shipped order.';

-- 4) Add shipping-specific statuses to order_status enum
-- Note: Must add values at the end due to PostgreSQL enum limitations
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'awaiting_shipment';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_delivery';

COMMENT ON TYPE order_status IS
  'Order lifecycle statuses. Shipping flow: pending → confirmed → awaiting_shipment → shipped → in_delivery → complete. Agent delivery flow uses different statuses (assigned_to_agent, picked_up, etc.).';
