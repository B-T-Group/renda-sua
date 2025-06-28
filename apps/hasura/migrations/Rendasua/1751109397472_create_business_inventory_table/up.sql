-- Create business_inventory table
CREATE TABLE public.business_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_location_id UUID NOT NULL,
    item_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0, -- Quantity available for orders
    reserved_quantity INTEGER NOT NULL DEFAULT 0, -- Quantity reserved for pending orders
    reorder_point INTEGER DEFAULT 0, -- When to reorder
    reorder_quantity INTEGER DEFAULT 0, -- How much to reorder
    unit_cost DECIMAL(10,2), -- Cost per unit for this location
    selling_price DECIMAL(10,2), -- Selling price at this location (can override item price)
    is_active BOOLEAN DEFAULT TRUE,
    last_restocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_business_inventory_location FOREIGN KEY (business_location_id) REFERENCES public.business_locations(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_business_inventory_item FOREIGN KEY (item_id) REFERENCES public.items(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT unique_location_item UNIQUE (business_location_id, item_id)
);

-- Create indexes for better performance
CREATE INDEX idx_business_inventory_location ON public.business_inventory(business_location_id);
CREATE INDEX idx_business_inventory_item ON public.business_inventory(item_id);
CREATE INDEX idx_business_inventory_active ON public.business_inventory(is_active);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_business_inventory_updated_at
    BEFORE UPDATE ON public.business_inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.business_inventory IS 'Tracks item inventory at specific business locations';
COMMENT ON COLUMN public.business_inventory.quantity IS 'Total quantity at this location';
COMMENT ON COLUMN public.business_inventory.available_quantity IS 'Quantity available for orders';
COMMENT ON COLUMN public.business_inventory.reserved_quantity IS 'Quantity reserved for pending orders';
COMMENT ON COLUMN public.business_inventory.reorder_point IS 'Inventory level at which to reorder';
COMMENT ON COLUMN public.business_inventory.reorder_quantity IS 'How much to reorder when below reorder point';
COMMENT ON COLUMN public.business_inventory.unit_cost IS 'Cost per unit for this location';
COMMENT ON COLUMN public.business_inventory.selling_price IS 'Selling price at this location (can override item price)';
