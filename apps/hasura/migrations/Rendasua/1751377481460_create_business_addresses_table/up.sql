-- Create business_addresses table
CREATE TABLE public.business_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL,
    address_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_business_addresses_business_id FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_business_addresses_address_id FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE CASCADE,
    
    -- Unique constraint on address_id to ensure one-to-one relationship
    CONSTRAINT unique_business_address_address_id UNIQUE (address_id)
);

-- Create indexes for better performance
CREATE INDEX idx_business_addresses_business_id ON public.business_addresses(business_id);
CREATE INDEX idx_business_addresses_address_id ON public.business_addresses(address_id);
