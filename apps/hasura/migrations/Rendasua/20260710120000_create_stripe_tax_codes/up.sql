-- Stripe Tax product classification reference (synced from Stripe Tax Codes API)

CREATE TABLE public.stripe_tax_codes (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    requirements JSONB,
    group_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_tax_codes_fts ON public.stripe_tax_codes
    USING gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

CREATE INDEX idx_stripe_tax_codes_group ON public.stripe_tax_codes(group_name);
CREATE INDEX idx_stripe_tax_codes_active ON public.stripe_tax_codes(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE public.stripe_tax_codes IS 'Stripe Tax product tax codes; synced from Stripe API';

-- Default code required before items FK is added
INSERT INTO public.stripe_tax_codes (id, name, description, group_name, is_active)
VALUES (
    'txcd_99999999',
    'General - Tangible Goods',
    'A physical good that can be moved or touched. Also known as tangible personal property.',
    'General',
    TRUE
)
ON CONFLICT (id) DO NOTHING;
