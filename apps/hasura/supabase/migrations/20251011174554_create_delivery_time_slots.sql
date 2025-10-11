-- Create delivery_time_slots table
CREATE TABLE public.delivery_time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL,
    state_code VARCHAR(50),
    slot_name VARCHAR(50) NOT NULL,
    slot_type VARCHAR(20) NOT NULL CHECK (slot_type IN ('standard', 'fast')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    max_orders_per_slot INTEGER DEFAULT 10,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_slot_time CHECK (end_time > start_time),
    CONSTRAINT unique_slot_per_location UNIQUE (country_code, state_code, slot_name, slot_type)
);

-- Create indexes for better performance
CREATE INDEX idx_delivery_time_slots_location ON public.delivery_time_slots(country_code, state_code);
CREATE INDEX idx_delivery_time_slots_type ON public.delivery_time_slots(slot_type);
CREATE INDEX idx_delivery_time_slots_active ON public.delivery_time_slots(is_active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_delivery_time_slots_updated_at
    BEFORE UPDATE ON public.delivery_time_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.delivery_time_slots IS 'Predefined delivery time slots by location and type';
COMMENT ON COLUMN public.delivery_time_slots.slot_type IS 'Type of delivery: standard (24-48h) or fast (2-4h)';
COMMENT ON COLUMN public.delivery_time_slots.max_orders_per_slot IS 'Maximum number of orders that can be booked for this slot per day';
