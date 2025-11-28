-- Remove foreign key constraint
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_delivery_time_window_id_fkey;

