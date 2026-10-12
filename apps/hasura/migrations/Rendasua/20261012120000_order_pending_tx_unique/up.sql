-- #545 PR-1: pay-at-confirm retry. Additive and idempotent (safe to re-run).
-- 1. Attempt-tracking columns on mobile_payment_transactions. Each row already is one
--    payment attempt (phone, provider transaction id, status, timestamps); these columns
--    record why/when an attempt was replaced and by which attempt.
ALTER TABLE public.mobile_payment_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid,
  ADD COLUMN IF NOT EXISTS superseded_reason text,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mobile_payment_transactions_superseded_by_id_fkey'
  ) THEN
    ALTER TABLE public.mobile_payment_transactions
      ADD CONSTRAINT mobile_payment_transactions_superseded_by_id_fkey
      FOREIGN KEY (superseded_by_id)
      REFERENCES public.mobile_payment_transactions(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Duplicate cleanup BEFORE the unique index: keep the newest pending order tx per
--    order, cancel older ones as superseded so a late provider SUCCESS on them still goes
--    through the late-success handler (wallet credit + alert) instead of being dropped.
UPDATE public.mobile_payment_transactions t
SET status = 'cancelled',
    error_code = 'SUPERSEDED_BY_RETRY',
    error_message = 'Superseded: duplicate pending order payment cleaned up by migration',
    superseded_reason = 'migration_duplicate_cleanup',
    superseded_at = now(),
    superseded_by_id = keep.id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (entity_id) id, entity_id
  FROM public.mobile_payment_transactions
  WHERE payment_entity = 'order' AND status = 'pending' AND entity_id IS NOT NULL
  ORDER BY entity_id, created_at DESC, id DESC
) keep
WHERE t.payment_entity = 'order'
  AND t.status = 'pending'
  AND t.entity_id = keep.entity_id
  AND t.id <> keep.id;

-- 3. Cross-instance guard: at most one pending order payment per order.
CREATE UNIQUE INDEX IF NOT EXISTS mobile_payment_transactions_one_pending_order_uidx
  ON public.mobile_payment_transactions (entity_id)
  WHERE payment_entity = 'order' AND status = 'pending';

-- 4. Idempotency-Key: one attempt per (order, key).
CREATE UNIQUE INDEX IF NOT EXISTS mobile_payment_transactions_entity_idempotency_uidx
  ON public.mobile_payment_transactions (entity_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Rate-limit lookups (attempts per order in the last 10 minutes).
CREATE INDEX IF NOT EXISTS mobile_payment_transactions_entity_created_idx
  ON public.mobile_payment_transactions (entity_id, created_at);
