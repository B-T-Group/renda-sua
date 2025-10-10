-- Migration Rollback: Remove fast delivery support from orders table
-- Description: Removes fast delivery columns and constraints

-- Drop the index
DROP INDEX IF EXISTS idx_orders_requires_fast_delivery;

-- Drop the constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_fast_delivery_fee_check;

-- Drop the columns
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS fast_delivery_fee;

ALTER TABLE public.orders 
DROP COLUMN IF EXISTS requires_fast_delivery;

