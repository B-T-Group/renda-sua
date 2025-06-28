-- Create size_units enum
CREATE TYPE public.size_units_enum AS ENUM ('cm', 'm', 'inch', 'ft', 'mm');

-- Create weight_units enum
CREATE TYPE public.weight_units_enum AS ENUM ('g', 'kg', 'lb', 'oz');

-- Create items table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    item_sub_category_id INTEGER NOT NULL,
    size DECIMAL(10,2),
    size_unit size_units_enum,
    weight DECIMAL(10,2),
    weight_unit weight_units_enum,
    price DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    sku TEXT UNIQUE,
    brand TEXT,
    model TEXT,
    color TEXT,
    material TEXT,
    is_fragile BOOLEAN DEFAULT FALSE,
    is_perishable BOOLEAN DEFAULT FALSE,
    requires_special_handling BOOLEAN DEFAULT FALSE,
    max_delivery_distance INTEGER, -- in kilometers
    estimated_delivery_time INTEGER, -- in minutes
    min_order_quantity INTEGER DEFAULT 1,
    max_order_quantity INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_item_sub_category FOREIGN KEY (item_sub_category_id) REFERENCES public.item_sub_categories(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- Create indexes for better performance
CREATE INDEX idx_items_sub_category ON public.items(item_sub_category_id);
CREATE INDEX idx_items_active ON public.items(is_active);
CREATE INDEX idx_items_price ON public.items(price);
CREATE INDEX idx_items_sku ON public.items(sku);

-- Create or replace the updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at column
CREATE TRIGGER set_public_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_items_updated_at ON public.items
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';
