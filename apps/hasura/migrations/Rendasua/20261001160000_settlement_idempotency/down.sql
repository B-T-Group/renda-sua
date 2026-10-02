ALTER TABLE public.order_holds
  DROP COLUMN IF EXISTS delivery_settlement_claimed_at,
  DROP COLUMN IF EXISTS item_settlement_claimed_at;

ALTER TABLE public.account_transactions
  DROP CONSTRAINT IF EXISTS account_transactions_idempotency_key_key;
ALTER TABLE public.account_transactions
  DROP COLUMN IF EXISTS idempotency_key;
