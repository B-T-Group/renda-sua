ALTER TABLE public.purchase_credit_grants
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_purchase_credit_grants_revoked
  ON public.purchase_credit_grants (user_id)
  WHERE revoked_at IS NULL;
