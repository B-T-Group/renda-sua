-- Agent BoldSign agreements. Signing is required to claim work when
-- application_configurations.agent_contract_required is true (default).

INSERT INTO public.application_configurations (
  config_key,
  config_name,
  description,
  data_type,
  boolean_value,
  country_code,
  status,
  version,
  tags
)
SELECT
  'agent_contract_required',
  'Agent contract required',
  'Agents must sign the region and language BoldSign agreement before they can claim or be offered orders.',
  'boolean',
  true,
  NULL,
  'active',
  1,
  ARRAY['agents', 'contracts', 'feature-flag']
WHERE NOT EXISTS (
  SELECT 1 FROM public.application_configurations
  WHERE config_key = 'agent_contract_required' AND country_code IS NULL
);

CREATE TABLE public.agent_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  boldsign_template_id TEXT NOT NULL,
  boldsign_document_id TEXT NOT NULL UNIQUE,
  contract_number TEXT NOT NULL,
  status public.contract_status_enum NOT NULL DEFAULT 'not_sent',
  signer_name TEXT,
  signer_email TEXT,
  prefill_snapshot JSONB,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  signed_pdf_s3_key TEXT,
  audit_certificate_s3_key TEXT,
  document_hash TEXT,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_agent_contracts_in_flight
  ON public.agent_contracts (agent_id)
  WHERE status IN ('not_sent', 'sent', 'viewed');

CREATE INDEX idx_agent_contracts_agent_id ON public.agent_contracts(agent_id);
CREATE INDEX idx_agent_contracts_status ON public.agent_contracts(status);

CREATE TRIGGER set_public_agent_contracts_updated_at
  BEFORE UPDATE ON public.agent_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();
