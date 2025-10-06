-- Create supported_payment_systems table
CREATE TABLE public.supported_payment_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country CHAR(2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_payment_system_country UNIQUE (name, country)
);

-- Create indexes for better performance
CREATE INDEX idx_supported_payment_systems_country ON public.supported_payment_systems(country);
CREATE INDEX idx_supported_payment_systems_active ON public.supported_payment_systems(active);
CREATE INDEX idx_supported_payment_systems_name ON public.supported_payment_systems(name);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_supported_payment_systems_updated_at
    BEFORE UPDATE ON public.supported_payment_systems
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comment to the trigger
COMMENT ON TRIGGER set_public_supported_payment_systems_updated_at ON public.supported_payment_systems
    IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- Insert initial data
INSERT INTO public.supported_payment_systems (name, country, active) VALUES
    ('airtel', 'GA', true),
    ('moov', 'GA', false),
    ('mtn', 'CM', false),
    ('orange', 'CM', false);
