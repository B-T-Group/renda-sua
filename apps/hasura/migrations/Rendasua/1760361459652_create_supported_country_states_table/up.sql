-- Create supported_country_states table
-- This table stores information about supported countries and their states/provinces
CREATE TABLE IF NOT EXISTS public.supported_country_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    state_name VARCHAR(100) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    service_status VARCHAR(20) DEFAULT 'active' CHECK (service_status IN ('active', 'inactive', 'coming_soon')),
    delivery_enabled BOOLEAN DEFAULT TRUE,
    fast_delivery BOOLEAN DEFAULT FALSE,
    supported_payment_methods JSONB DEFAULT '[]'::jsonb,
    launch_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_country_state UNIQUE (country_code, state_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supported_country_states_country ON public.supported_country_states(country_code);
CREATE INDEX IF NOT EXISTS idx_supported_country_states_state ON public.supported_country_states(state_name);
CREATE INDEX IF NOT EXISTS idx_supported_country_states_status ON public.supported_country_states(service_status);
CREATE INDEX IF NOT EXISTS idx_supported_country_states_delivery ON public.supported_country_states(delivery_enabled);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_supported_country_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supported_country_states_updated_at
    BEFORE UPDATE ON public.supported_country_states
    FOR EACH ROW
    EXECUTE FUNCTION update_supported_country_states_updated_at();

-- Add comments
COMMENT ON TABLE public.supported_country_states IS 'Supported countries and their states/provinces with service configuration';
COMMENT ON COLUMN public.supported_country_states.service_status IS 'Current service status: active, inactive, or coming_soon';
COMMENT ON COLUMN public.supported_country_states.delivery_enabled IS 'Whether delivery service is available in this state';
COMMENT ON COLUMN public.supported_country_states.fast_delivery IS 'Whether fast delivery is available in this state';
COMMENT ON COLUMN public.supported_country_states.supported_payment_methods IS 'JSON array of supported payment methods for this state';
