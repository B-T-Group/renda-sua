-- Create client_addresses table
CREATE TABLE public.client_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL,
    address_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_client_addresses_client_id FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_client_addresses_address_id FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE CASCADE,
    
    -- Unique constraint on address_id to ensure one-to-one relationship
    CONSTRAINT unique_client_address_address_id UNIQUE (address_id)
);

-- Create indexes for better performance
CREATE INDEX idx_client_addresses_client_id ON public.client_addresses(client_id);
CREATE INDEX idx_client_addresses_address_id ON public.client_addresses(address_id);
