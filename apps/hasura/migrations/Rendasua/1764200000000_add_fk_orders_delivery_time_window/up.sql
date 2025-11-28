-- Add explicit foreign key constraint for delivery_time_window_id
-- This ensures Hasura can detect the relationship

-- First, check if the column exists and add it if it doesn't
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'delivery_time_window_id'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN delivery_time_window_id UUID;
    END IF;
END $$;

-- Drop the constraint if it exists (to avoid conflicts)
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_delivery_time_window_id_fkey;

-- Add the foreign key constraint with explicit name
ALTER TABLE public.orders 
ADD CONSTRAINT orders_delivery_time_window_id_fkey 
FOREIGN KEY (delivery_time_window_id) 
REFERENCES public.delivery_time_windows(id) 
ON DELETE SET NULL;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_orders_delivery_time_window_id 
ON public.orders(delivery_time_window_id);

-- Add comment
COMMENT ON CONSTRAINT orders_delivery_time_window_id_fkey ON public.orders 
IS 'Foreign key constraint linking delivery_time_window_id to delivery_time_windows table for delivery_time_window relationship';

