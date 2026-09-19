DROP INDEX IF EXISTS public.idx_purchase_credit_grants_revoked;

ALTER TABLE public.purchase_credit_grants
  DROP COLUMN IF EXISTS revoked_at;
