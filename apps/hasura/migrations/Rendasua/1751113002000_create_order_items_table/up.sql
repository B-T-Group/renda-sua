-- Create order_items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    business_inventory_id UUID NOT NULL REFERENCES business_inventory(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    
    -- Item details at time of order
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Item specifications
    weight DECIMAL(8,3),
    weight_unit VARCHAR(10),
    dimensions VARCHAR(100),
    
    -- Special requirements
    special_instructions TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
    CONSTRAINT order_items_total_price_check CHECK (total_price >= 0),
    CONSTRAINT order_items_weight_check CHECK (weight IS NULL OR weight > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_business_inventory_id ON order_items(business_inventory_id);
CREATE INDEX idx_order_items_item_id ON order_items(item_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_items_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_items_updated_at();

-- Create trigger to calculate total_price
CREATE OR REPLACE FUNCTION calculate_order_item_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price := NEW.unit_price * NEW.quantity;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_order_item_total
    BEFORE INSERT OR UPDATE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_order_item_total(); 