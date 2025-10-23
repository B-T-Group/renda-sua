-- Migration: create_partners_table
-- Description: Create partners table to store partner commission configurations

CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    base_delivery_fee_commission DECIMAL(5,2) NOT NULL DEFAULT 0,
    per_km_delivery_fee_commission DECIMAL(5,2) NOT NULL DEFAULT 0,
    item_commission DECIMAL(5,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_partner_user UNIQUE (user_id),
    CONSTRAINT valid_commission_percentages CHECK (
        base_delivery_fee_commission >= 0 AND base_delivery_fee_commission <= 100 AND
        per_km_delivery_fee_commission >= 0 AND per_km_delivery_fee_commission <= 100 AND
        item_commission >= 0 AND item_commission <= 100
    )
);

-- Create indexes for better performance
CREATE INDEX idx_partners_user_id ON public.partners(user_id);
CREATE INDEX idx_partners_is_active ON public.partners(is_active);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_partners_updated_at
    BEFORE UPDATE ON public.partners
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.partners IS 'Partner commission configurations and details';
COMMENT ON COLUMN public.partners.base_delivery_fee_commission IS 'Commission percentage on base delivery fee';
COMMENT ON COLUMN public.partners.per_km_delivery_fee_commission IS 'Commission percentage on per-km delivery fee';
COMMENT ON COLUMN public.partners.item_commission IS 'Commission percentage on RendaSua item commission';
