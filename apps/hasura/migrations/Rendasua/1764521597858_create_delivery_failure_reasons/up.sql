-- Create delivery_failure_reasons table
CREATE TABLE public.delivery_failure_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_key VARCHAR(100) NOT NULL UNIQUE,
    reason_en VARCHAR(255) NOT NULL,
    reason_fr VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_delivery_failure_reasons_is_active ON public.delivery_failure_reasons(is_active);
CREATE INDEX idx_delivery_failure_reasons_sort_order ON public.delivery_failure_reasons(sort_order);

-- Create trigger for updated_at column
CREATE TRIGGER set_public_delivery_failure_reasons_updated_at
    BEFORE UPDATE ON public.delivery_failure_reasons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Add comments
COMMENT ON TABLE public.delivery_failure_reasons IS 'Predefined reasons for delivery failures with bilingual support (EN/FR)';
COMMENT ON COLUMN public.delivery_failure_reasons.reason_key IS 'Internal key for the failure reason (e.g., accident, theft)';
COMMENT ON COLUMN public.delivery_failure_reasons.reason_en IS 'English translation of the failure reason';
COMMENT ON COLUMN public.delivery_failure_reasons.reason_fr IS 'French translation of the failure reason (default)';
COMMENT ON COLUMN public.delivery_failure_reasons.is_active IS 'Whether this reason is currently active and available for selection';
COMMENT ON COLUMN public.delivery_failure_reasons.sort_order IS 'Order in which reasons should be displayed in UI';

-- Insert seed data with French as default
INSERT INTO public.delivery_failure_reasons (reason_key, reason_en, reason_fr, sort_order) VALUES
('accident', 'Accident', 'Accident', 1),
('theft', 'Theft', 'Vol', 2),
('item_damaged', 'Item Damaged', 'Article endommagé', 3),
('client_refused_to_collect', 'Client Refused to Collect Item', 'Client a refusé de récupérer l''article', 4),
('address_not_found', 'Could Not Find Client Delivery Address', 'Impossible de trouver l''adresse de livraison du client', 5),
('client_unreachable', 'Could Not Contact Client', 'Impossible de contacter le client', 6),
('other', 'Other', 'Autre', 7);

