-- Rollback: Recreate delivery_fees table
-- Note: This is a simplified recreation. Original data is not restored.

CREATE TABLE public.delivery_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conditions JSONB DEFAULT '{}',
    fee DECIMAL(10,2) NOT NULL,
    currency currency_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_delivery_fees_currency ON public.delivery_fees(currency);
CREATE INDEX idx_delivery_fees_created_at ON public.delivery_fees(created_at);

