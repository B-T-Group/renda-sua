-- Track mobile payments used to reconcile pay-at-delivery cash exceptions (no client wallet leg).
ALTER TYPE public.payment_entity_type ADD VALUE IF NOT EXISTS 'order_cash_reconciliation';
