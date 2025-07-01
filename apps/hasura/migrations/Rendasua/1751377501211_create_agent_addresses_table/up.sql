-- Create agent_addresses table
CREATE TABLE public.agent_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL,
    address_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_agent_addresses_agent_id FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_addresses_address_id FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE CASCADE,
    
    -- Unique constraint on address_id to ensure one-to-one relationship
    CONSTRAINT unique_agent_address_address_id UNIQUE (address_id)
);

-- Create indexes for better performance
CREATE INDEX idx_agent_addresses_agent_id ON public.agent_addresses(agent_id);
CREATE INDEX idx_agent_addresses_address_id ON public.agent_addresses(address_id);
