ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_first_order_base_delivery_discount_amount_check;
ALTER TABLE orders
  DROP COLUMN IF EXISTS first_order_base_delivery_discount_amount,
  DROP COLUMN IF EXISTS first_order_delivery_fee_promo;
