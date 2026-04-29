-- Rollback pay-on-delivery feature additions

-- Orders: drop added columns first (FK dependencies)
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS reconciliation_notes,
  DROP COLUMN IF EXISTS reconciliation_reference,
  DROP COLUMN IF EXISTS reconciled_at,
  DROP COLUMN IF EXISTS reconciled_by_business_id,
  DROP COLUMN IF EXISTS cash_exception_reported_at,
  DROP COLUMN IF EXISTS cash_exception_reported_by_agent_id,
  DROP COLUMN IF EXISTS reconciliation_status,
  DROP COLUMN IF EXISTS payment_timing;

-- Drop enums if they exist
DROP TYPE IF EXISTS public.order_reconciliation_status_enum;
DROP TYPE IF EXISTS public.order_payment_timing_enum;

-- Items
ALTER TABLE public.items
  DROP COLUMN IF EXISTS pay_on_delivery_enabled;

