DROP INDEX IF EXISTS public.idx_order_holds_settlement_retry;
ALTER TABLE public.order_holds
  DROP COLUMN IF EXISTS settlement_next_retry_at,
  DROP COLUMN IF EXISTS settlement_failed_at,
  DROP COLUMN IF EXISTS settlement_retry_count,
  DROP COLUMN IF EXISTS settlement_last_error,
  DROP COLUMN IF EXISTS settlement_failed_stage;
