-- Remove delivery time window reference from orders table
DROP INDEX IF EXISTS idx_orders_delivery_time_window_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivery_time_window_id;
