ALTER TABLE public.business_contracts
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_contracts_in_flight
  ON public.business_contracts (business_id)
  WHERE status IN ('not_sent', 'sent', 'viewed');
