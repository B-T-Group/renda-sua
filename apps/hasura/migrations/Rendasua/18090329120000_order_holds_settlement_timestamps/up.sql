-- Idempotency for split item vs delivery settlement
ALTER TABLE public.order_holds
  ADD COLUMN IF NOT EXISTS item_settlement_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS delivery_settlement_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.order_holds.item_settlement_completed_at IS 'When item/subtotal hold was released and item commissions were distributed (pickup)';
COMMENT ON COLUMN public.order_holds.delivery_settlement_completed_at IS 'When delivery hold was released and delivery commissions were distributed (order complete)';
