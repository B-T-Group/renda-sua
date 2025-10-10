-- Migration: Add fast delivery support to orders table
-- Description: Adds columns to track fast delivery requests and associated fees

-- Add fast delivery flag to orders table
ALTER TABLE public.orders 
ADD COLUMN requires_fast_delivery BOOLEAN NOT NULL DEFAULT FALSE;

-- Add fast delivery fee column (additional charge for expedited service)
ALTER TABLE public.orders 
ADD COLUMN fast_delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add constraint to ensure fast delivery fee is non-negative
ALTER TABLE public.orders
ADD CONSTRAINT orders_fast_delivery_fee_check CHECK (fast_delivery_fee >= 0);

-- Create index for filtering fast delivery orders (only indexes TRUE values for efficiency)
CREATE INDEX idx_orders_requires_fast_delivery 
ON public.orders(requires_fast_delivery) 
WHERE requires_fast_delivery = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN public.orders.requires_fast_delivery IS 
'Indicates whether this order requires expedited/fast delivery service (typically 2-4 hours)';

COMMENT ON COLUMN public.orders.fast_delivery_fee IS 
'Additional fee charged for fast delivery service, added to the base delivery_fee';

