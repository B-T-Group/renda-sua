-- Migration: Update delivery fee structure in orders table
-- Description: Rename delivery_fee to base_delivery_fee and fast_delivery_fee to per_km_delivery_fee

-- Rename delivery_fee to base_delivery_fee
ALTER TABLE public.orders 
RENAME COLUMN delivery_fee TO base_delivery_fee;

-- Rename fast_delivery_fee to per_km_delivery_fee
ALTER TABLE public.orders 
RENAME COLUMN fast_delivery_fee TO per_km_delivery_fee;

-- Update constraints
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_delivery_fee_check;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_fast_delivery_fee_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_base_delivery_fee_check CHECK (base_delivery_fee >= 0);

ALTER TABLE public.orders
ADD CONSTRAINT orders_per_km_delivery_fee_check CHECK (per_km_delivery_fee >= 0);

-- Update comments
COMMENT ON COLUMN public.orders.base_delivery_fee IS 
'Base delivery fee used for this order (either base_delivery_fee or fast_delivery_fee from config)';

COMMENT ON COLUMN public.orders.per_km_delivery_fee IS 
'Per-kilometer delivery fee calculated as (per_km_rate * distance)';
