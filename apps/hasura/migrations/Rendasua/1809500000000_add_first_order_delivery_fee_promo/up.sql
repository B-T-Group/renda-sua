-- First-order delivery fee promotion metadata (halved base fee on client's first order)
ALTER TABLE orders ADD COLUMN first_order_delivery_fee_promo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN first_order_base_delivery_discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD CONSTRAINT orders_first_order_base_delivery_discount_amount_check CHECK (first_order_base_delivery_discount_amount >= 0);
