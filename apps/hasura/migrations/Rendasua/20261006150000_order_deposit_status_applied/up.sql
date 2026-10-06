-- PR #459 fix-forward (QA B-1): mark a reservation deposit that settlement consumed.
--
-- 'applied' = the held deposit was released and counted in the order settlement
-- (classic pay-at-pickup / pay-at-delivery remainder paid, or cash exception).
-- Forfeit and refund only act on deposit_status = 'paid', so an applied deposit
-- can never be forfeited (double charge) or refunded a second time.
--
-- Additive and idempotent. No backfill here: Postgres does not allow using a new
-- enum value in the transaction that adds it. Legacy settled rows still read
-- 'paid'; the backend refuses to forfeit/refund them when order_holds shows the
-- item settlement ran (and re-labels them 'applied' on that path).
ALTER TYPE public.order_deposit_status_enum ADD VALUE IF NOT EXISTS 'applied';

COMMENT ON TYPE public.order_deposit_status_enum IS
  'Deposit payment status: none (no deposit), pending (awaiting callback), paid (captured, held), failed (callback failed), forfeited (moved to Rendasua after a customer no-show/cancel after lock), refunded (released to client wallet), applied (consumed by order settlement)';

COMMENT ON COLUMN public.orders.deposit_status IS
  'Deposit lifecycle: none (no deposit required), pending (awaiting MoMo callback), paid (captured and held), failed (payment failed), forfeited (customer forfeit), refunded (released to client wallet), applied (released and counted in settlement; terminal)';
