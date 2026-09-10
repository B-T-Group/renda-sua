-- Tracked MoMo GIVE_CHANGE rows for reservation-deposit refunds.
-- Distinguishes refund payouts from order_deposit collections so callbacks
-- can complete deposit_status=refunded and claw back the client wallet credit.
ALTER TYPE public.payment_entity_type ADD VALUE IF NOT EXISTS 'order_deposit_refund';
