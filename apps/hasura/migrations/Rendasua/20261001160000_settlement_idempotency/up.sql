-- Migration: settlement_idempotency (UAT finding S-4)
--
-- 1) account_transactions.idempotency_key: optional once-only key for ledger moves
--    (settlement client release/payment, commission payouts). A plain UNIQUE
--    constraint (not a partial index) so Hasura can use it in `on_conflict`;
--    Postgres allows any number of NULLs, so existing rows and callers that do not
--    pass a key are unaffected. Additive only: no backfill, no existing row changes.
-- 2) order_holds.{item,delivery}_settlement_claimed_at: per-stage settlement lease
--    (compare-and-set before any ledger move) so a normal-flow trigger and a
--    retry sweep cannot settle the same stage concurrently.

ALTER TABLE public.account_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_transactions_idempotency_key_key'
      AND conrelid = 'public.account_transactions'::regclass
  ) THEN
    ALTER TABLE public.account_transactions
      ADD CONSTRAINT account_transactions_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

COMMENT ON COLUMN public.account_transactions.idempotency_key IS
  'Optional once-only key; a second ledger row with the same key is rejected by the unique constraint (settlement / commission payouts).';

ALTER TABLE public.order_holds
  ADD COLUMN IF NOT EXISTS item_settlement_claimed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS delivery_settlement_claimed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.order_holds.item_settlement_claimed_at IS
  'Lease taken (compare-and-set) before the item settlement stage moves money; stale after SETTLEMENT_CLAIM_LEASE_MINUTES.';
COMMENT ON COLUMN public.order_holds.delivery_settlement_claimed_at IS
  'Lease taken (compare-and-set) before the delivery settlement stage moves money; stale after SETTLEMENT_CLAIM_LEASE_MINUTES.';
