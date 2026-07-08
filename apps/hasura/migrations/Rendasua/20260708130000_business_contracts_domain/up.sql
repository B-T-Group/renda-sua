-- Migration: business_contracts_domain
-- BoldSign e-signature contract tracking for merchant agreements.

CREATE TYPE public.contract_status_enum AS ENUM (
  'not_sent',
  'sent',
  'viewed',
  'signed',
  'declined',
  'expired',
  'cancelled',
  'failed'
);

CREATE TABLE public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  boldsign_template_id_en TEXT NOT NULL,
  boldsign_template_id_fr TEXT,
  title TEXT,
  changelog TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
  resign_required_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin_user_id UUID REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL
);

CREATE UNIQUE INDEX uq_contract_templates_one_active
  ON public.contract_templates ((TRUE))
  WHERE is_active = TRUE AND is_legacy = FALSE;

CREATE TABLE public.business_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  contract_template_id UUID NOT NULL REFERENCES public.contract_templates(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  contract_version TEXT NOT NULL,
  boldsign_document_id TEXT NOT NULL UNIQUE,
  status public.contract_status_enum NOT NULL DEFAULT 'not_sent',
  signer_name TEXT,
  signer_email TEXT,
  signer_ip_address TEXT,
  signer_user_agent TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  decline_reason TEXT,
  failure_reason TEXT,
  signed_pdf_s3_key TEXT,
  audit_certificate_s3_key TEXT,
  document_hash TEXT,
  boldsign_raw_metadata JSONB,
  invalidated_at TIMESTAMPTZ,
  invalidated_by_user_id UUID REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  invalidation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_business_contracts_signed_per_version
  ON public.business_contracts (business_id, contract_template_id)
  WHERE status = 'signed';

CREATE INDEX idx_business_contracts_business_id ON public.business_contracts(business_id);
CREATE INDEX idx_business_contracts_status ON public.business_contracts(status);
CREATE INDEX idx_business_contracts_boldsign_document_id ON public.business_contracts(boldsign_document_id);

CREATE TRIGGER set_public_business_contracts_updated_at
  BEFORE UPDATE ON public.business_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TABLE public.business_contract_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  boldsign_document_id TEXT NOT NULL,
  business_contract_id UUID REFERENCES public.business_contracts(id) ON UPDATE RESTRICT ON DELETE SET NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_business_contract_events_document_id
  ON public.business_contract_events(boldsign_document_id);
CREATE INDEX idx_business_contract_events_unprocessed
  ON public.business_contract_events(received_at)
  WHERE processed_at IS NULL;

-- Legacy template for grandfathered in-app acceptances
INSERT INTO public.contract_templates (
  version,
  boldsign_template_id_en,
  title,
  is_active,
  is_legacy
) VALUES (
  'legacy-in-app-v1',
  'legacy',
  'Legacy in-app merchant agreement (pre-BoldSign)',
  FALSE,
  TRUE
);

-- Seed active template placeholder (BoldSign template IDs configured via admin or env)
INSERT INTO public.contract_templates (
  version,
  boldsign_template_id_en,
  boldsign_template_id_fr,
  title,
  is_active,
  is_legacy
) VALUES (
  '2026-08-1',
  'REPLACE_WITH_BOLDSIGN_TEMPLATE_ID_EN',
  'REPLACE_WITH_BOLDSIGN_TEMPLATE_ID_FR',
  'RendaSua Merchant Partnership Agreement',
  TRUE,
  FALSE
);

-- Backfill legacy signed contracts from in-app acceptances
INSERT INTO public.business_contracts (
  business_id,
  contract_template_id,
  contract_version,
  boldsign_document_id,
  status,
  signer_name,
  signer_email,
  signed_at,
  signed_pdf_s3_key,
  created_at,
  updated_at
)
SELECT
  bma.business_id,
  ct.id,
  bma.agreement_version,
  'legacy:' || bma.id::TEXT,
  'signed'::public.contract_status_enum,
  bma.signer_legal_name,
  bma.signer_email,
  bma.accepted_at,
  uu.key,
  bma.created_at,
  bma.updated_at
FROM public.business_merchant_agreement_acceptances bma
JOIN public.contract_templates ct ON ct.version = 'legacy-in-app-v1'
LEFT JOIN public.user_uploads uu ON uu.id = bma.pdf_upload_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_contracts bc
  WHERE bc.business_id = bma.business_id
    AND bc.contract_template_id = ct.id
    AND bc.status = 'signed'
);
