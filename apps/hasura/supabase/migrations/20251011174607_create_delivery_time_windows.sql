-- Create delivery_time_windows table
CREATE TABLE public.delivery_time_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES public.delivery_time_slots(id),
    preferred_date DATE NOT NULL,
    time_slot_start TIME NOT NULL,
    time_slot_end TIME NOT NULL,
    is_confirmed BOOLEAN DEFAULT FALSE,
    special_instructions TEXT,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT future_date CHECK (preferred_date >= CURRENT_DATE),
    CONSTRAINT unique_order_window UNIQUE (order_id)
);

-- Create indexes for better performance
CREATE INDEX idx_delivery_time_windows_order_id ON public.delivery_time_windows(order_id);
CREATE INDEX idx_delivery_time_windows_slot_id ON public.delivery_time_windows(slot_id);
CREATE INDEX idx_delivery_time_windows_date ON public.delivery_time_windows(preferred_date);
CREATE INDEX idx_delivery_time_windows_confirmed ON public.delivery_time_windows(is_confirmed);

-- Create trigger for updated_at
CREATE TRIGGER update_delivery_time_windows_updated_at
    BEFORE UPDATE ON public.delivery_time_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.delivery_time_windows IS 'Client delivery time preferences per order';
COMMENT ON COLUMN public.delivery_time_windows.is_confirmed IS 'Whether the delivery window has been confirmed by the business';
COMMENT ON COLUMN public.delivery_time_windows.confirmed_by IS 'User ID who confirmed the delivery window';
