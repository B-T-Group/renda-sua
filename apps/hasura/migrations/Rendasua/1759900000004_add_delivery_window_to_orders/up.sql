-- Add delivery time window reference to orders table
ALTER TABLE public.orders 
ADD COLUMN delivery_time_window_id UUID REFERENCES public.delivery_time_windows(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_orders_delivery_time_window_id ON public.orders(delivery_time_window_id);

-- Add comment
COMMENT ON COLUMN public.orders.delivery_time_window_id IS 'Reference to client preferred delivery time window';
