ALTER TABLE public.order_holds
  DROP COLUMN IF EXISTS delivery_settlement_completed_at,
  DROP COLUMN IF EXISTS item_settlement_completed_at;
