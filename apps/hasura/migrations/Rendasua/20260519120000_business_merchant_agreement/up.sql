-- Merchant agreement acceptances (audit trail)
CREATE TABLE public.business_merchant_agreement_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    agreement_version TEXT NOT NULL,
    signer_legal_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    business_name TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    signature_image_key VARCHAR(500),
    pdf_upload_id UUID REFERENCES public.user_uploads(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bmaa_business_id ON public.business_merchant_agreement_acceptances(business_id);
CREATE INDEX idx_bmaa_accepted_at ON public.business_merchant_agreement_acceptances(accepted_at DESC);

CREATE UNIQUE INDEX idx_bmaa_business_version
    ON public.business_merchant_agreement_acceptances(business_id, agreement_version);

CREATE TRIGGER business_merchant_agreement_acceptances_updated_at
    BEFORE UPDATE ON public.business_merchant_agreement_acceptances
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.business_merchant_agreement_acceptances IS
    'Audit trail for in-app merchant partnership agreement acceptance';

-- Denormalized fields on businesses for fast status checks
ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS merchant_agreement_version TEXT,
    ADD COLUMN IF NOT EXISTS merchant_agreement_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.businesses.merchant_agreement_version IS
    'Latest merchant agreement version accepted by this business';
COMMENT ON COLUMN public.businesses.merchant_agreement_accepted_at IS
    'When the current merchant agreement version was accepted';
