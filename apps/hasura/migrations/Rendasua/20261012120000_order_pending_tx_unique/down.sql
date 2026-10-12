DROP INDEX IF EXISTS public.mobile_payment_transactions_entity_created_idx;
DROP INDEX IF EXISTS public.mobile_payment_transactions_entity_idempotency_uidx;
DROP INDEX IF EXISTS public.mobile_payment_transactions_one_pending_order_uidx;
ALTER TABLE public.mobile_payment_transactions
  DROP CONSTRAINT IF EXISTS mobile_payment_transactions_superseded_by_id_fkey;
ALTER TABLE public.mobile_payment_transactions
  DROP COLUMN IF EXISTS superseded_at,
  DROP COLUMN IF EXISTS superseded_reason,
  DROP COLUMN IF EXISTS superseded_by_id,
  DROP COLUMN IF EXISTS idempotency_key;
