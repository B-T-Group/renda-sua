-- Migration: Revert delivery fee structure changes
-- Description: Revert column names back to original delivery_fee and fast_delivery_fee

-- Revert column names
ALTER TABLE public.orders 
RENAME COLUMN base_delivery_fee TO delivery_fee;

ALTER TABLE public.orders 
RENAME COLUMN per_km_delivery_fee TO fast_delivery_fee;

-- Revert constraints
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_base_delivery_fee_check;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_per_km_delivery_fee_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_delivery_fee_check CHECK (delivery_fee >= 0);

ALTER TABLE public.orders
ADD CONSTRAINT orders_fast_delivery_fee_check CHECK (fast_delivery_fee >= 0);
