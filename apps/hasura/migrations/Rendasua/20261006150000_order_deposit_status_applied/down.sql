-- Postgres cannot drop a single enum value safely (it would mean recreating the
-- type and rewriting public.orders). Leave 'applied' in place, as done for other
-- enum additions in this repo.
--
-- Do NOT map 'applied' rows back to 'paid': a settled deposit that reads 'paid'
-- is exactly the state that let a no-show forfeit charge the deposit twice
-- (PR #459 QA B-1). Older backend code treats 'applied' as "not paid", which is
-- the safe direction (no refund, no forfeit).
COMMENT ON TYPE public.order_deposit_status_enum IS
  'Deposit payment status: none (no deposit), pending (awaiting callback), paid (captured), failed (callback failed), forfeited (after lock), refunded (before lock)';

COMMENT ON COLUMN public.orders.deposit_status IS
  'Deposit lifecycle: none (no deposit required), pending (awaiting MoMo callback), paid (captured), failed (payment failed), forfeited (customer forfeit after lock), refunded (refunded before lock)';
