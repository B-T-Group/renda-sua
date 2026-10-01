-- Settlement retry queue: when commission distribution fails the order still completes,
-- the failure is recorded on order_holds and a cron (OrderSettlementRetryService) retries it.
ALTER TABLE public.order_holds
  ADD COLUMN IF NOT EXISTS settlement_failed_stage TEXT NULL
    CHECK (settlement_failed_stage IN ('item', 'delivery')),
  ADD COLUMN IF NOT EXISTS settlement_last_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS settlement_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_failed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS settlement_next_retry_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.order_holds.settlement_failed_stage IS 'Set while an item/delivery settlement stage failed and awaits retry; cleared on success';
COMMENT ON COLUMN public.order_holds.settlement_next_retry_at IS 'When the retry cron may next run this hold (also used as a lease while a retry runs). NULL with a failed stage = retries exhausted, manual reconciliation needed';

CREATE INDEX IF NOT EXISTS idx_order_holds_settlement_retry
  ON public.order_holds (settlement_next_retry_at)
  WHERE settlement_failed_stage IS NOT NULL;
