-- Rollback carrier shipping migration

-- 1) Remove shipping tracking fields from orders table
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS shipping_tracking_number,
  DROP COLUMN IF EXISTS shipping_carrier,
  DROP COLUMN IF EXISTS shipped_at,
  DROP COLUMN IF EXISTS received_at;

-- 2) Remove shipping fields from items table
ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_shipping_price_non_negative,
  DROP COLUMN IF EXISTS shipping_enabled,
  DROP COLUMN IF EXISTS shipping_price,
  DROP COLUMN IF EXISTS shipping_currency;

-- Note: PostgreSQL does not support removing values from enums directly.
-- To fully rollback order_status and order_fulfillment_method_enum changes,
-- you would need to recreate the enums without the new values, which requires
-- dropping dependent columns first. This is typically not done in production.
--
-- Manual rollback instructions:
-- 1. Ensure no orders use fulfillment_method = 'shipping'
-- 2. Ensure no orders have current_status in ('awaiting_shipment', 'shipped', 'in_delivery')
-- 3. Recreate enums without new values and update dependent columns
