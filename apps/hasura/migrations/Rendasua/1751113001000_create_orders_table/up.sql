-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    business_location_id UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
    assigned_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    delivery_address_id UUID NOT NULL REFERENCES addresses(id) ON DELETE RESTRICT,
    
    -- Order details
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Order status and tracking
    current_status order_status NOT NULL DEFAULT 'pending',
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    
    -- Customer preferences
    special_instructions TEXT,
    preferred_delivery_time TIMESTAMP WITH TIME ZONE,
    
    -- Payment information
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT orders_total_amount_check CHECK (total_amount >= 0),
    CONSTRAINT orders_subtotal_check CHECK (subtotal >= 0),
    CONSTRAINT orders_delivery_fee_check CHECK (delivery_fee >= 0),
    CONSTRAINT orders_tax_amount_check CHECK (tax_amount >= 0)
);

-- Create indexes for better performance
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_business_id ON orders(business_id);
CREATE INDEX idx_orders_business_location_id ON orders(business_location_id);
CREATE INDEX idx_orders_assigned_agent_id ON orders(assigned_agent_id);
CREATE INDEX idx_orders_current_status ON orders(current_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Create function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(CAST(nextval('orders_order_number_seq') AS TEXT), 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE orders_order_number_seq START 1;

-- Create trigger to auto-generate order number
CREATE TRIGGER trigger_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number(); 