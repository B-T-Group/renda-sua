-- Create location_type enum
CREATE TYPE public.location_type_enum AS ENUM ('store', 'warehouse', 'office', 'pickup_point');

-- Create business_locations table
CREATE TABLE public.business_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    name TEXT NOT NULL, -- e.g., "Downtown Store", "Warehouse", "Main Office"
    address_id UUID NOT NULL,
    phone TEXT,
    email TEXT,
    operating_hours JSONB, -- Store operating hours as JSON
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE, -- Primary location for the business
    location_type location_type_enum DEFAULT 'store',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_business_locations_business FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_business_locations_address FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

-- Create indexes for better performance
CREATE INDEX idx_business_locations_business ON public.business_locations(business_id);
CREATE INDEX idx_business_locations_active ON public.business_locations(is_active);
CREATE INDEX idx_business_locations_primary ON public.business_locations(business_id, is_primary) WHERE is_primary = true;

-- Create trigger for updated_at column
CREATE TRIGGER set_public_business_locations_updated_at
    BEFORE UPDATE ON public.business_locations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.business_locations IS 'Stores multiple locations for each business';
COMMENT ON COLUMN public.business_locations.name IS 'Name of the location (e.g., Downtown Store, Warehouse)';
COMMENT ON COLUMN public.business_locations.operating_hours IS 'JSON object storing operating hours for each day';
COMMENT ON COLUMN public.business_locations.is_primary IS 'Whether this is the primary location for the business';
COMMENT ON COLUMN public.business_locations.location_type IS 'Type of location (store, warehouse, office, pickup_point, etc.)';
