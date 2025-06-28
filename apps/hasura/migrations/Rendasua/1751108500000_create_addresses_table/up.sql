-- Create enum for entity types
CREATE TYPE entity_type_enum AS ENUM ('user', 'business');

-- Create addresses table
CREATE TABLE public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type entity_type_enum NOT NULL,
    entity_id UUID NOT NULL,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Cameroon',
    is_primary BOOLEAN DEFAULT false,
    address_type VARCHAR(50) DEFAULT 'home', -- home, work, delivery, billing, etc.
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_addresses_entity ON public.addresses(entity_type, entity_id);
CREATE INDEX idx_addresses_primary ON public.addresses(entity_type, entity_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_addresses_location ON public.addresses(latitude, longitude);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_addresses_updated_at 
    BEFORE UPDATE ON public.addresses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.addresses IS 'Polymorphic address table supporting multiple addresses for users and businesses';
COMMENT ON COLUMN public.addresses.entity_type IS 'Type of entity this address belongs to (user or business)';
COMMENT ON COLUMN public.addresses.entity_id IS 'ID of the entity this address belongs to';
COMMENT ON COLUMN public.addresses.is_primary IS 'Whether this is the primary address for the entity';
COMMENT ON COLUMN public.addresses.address_type IS 'Type of address (home, work, delivery, billing, etc.)'; 