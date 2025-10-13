-- Create supported_country_states table
CREATE TABLE public.supported_country_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code CHAR(2) NOT NULL, -- ISO 3166-1 alpha-2 (e.g., 'GA', 'CM')
    country_name VARCHAR(100) NOT NULL,
    state_code VARCHAR(50), -- State/province code (e.g., 'CA', 'NY', 'Littoral')
    state_name VARCHAR(100) NOT NULL,
    currency_code CHAR(3) NOT NULL, -- ISO 4217 (e.g., 'XAF', 'USD')
    service_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (service_status IN ('active', 'coming_soon', 'suspended', 'inactive')),
    delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    fast_delivery JSONB, -- JSON configuration for fast delivery settings
    supported_payment_methods TEXT[], -- Array of supported payment methods
    launch_date DATE, -- When delivery service launched in this location
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    CONSTRAINT unique_country_state UNIQUE (country_code, state_code)
);

-- Create indexes for better performance
CREATE INDEX idx_supported_country_states_country ON public.supported_country_states(country_code);
CREATE INDEX idx_supported_country_states_service_status ON public.supported_country_states(service_status);
CREATE INDEX idx_supported_country_states_delivery_enabled ON public.supported_country_states(delivery_enabled);
CREATE INDEX idx_supported_country_states_country_state ON public.supported_country_states(country_code, state_code);

-- Create trigger for updated_at
CREATE TRIGGER update_supported_country_states_updated_at
    BEFORE UPDATE ON public.supported_country_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.supported_country_states IS 'Supported delivery locations by country and state';
COMMENT ON COLUMN public.supported_country_states.fast_delivery IS 'JSON configuration for fast delivery settings including enabled status, fees, timing, and operating hours';
COMMENT ON COLUMN public.supported_country_states.service_status IS 'Service status: active, coming_soon, suspended, or inactive';
COMMENT ON COLUMN public.supported_country_states.delivery_enabled IS 'Whether standard delivery is enabled for this location';
COMMENT ON COLUMN public.supported_country_states.supported_payment_methods IS 'Array of supported payment methods for this location';
