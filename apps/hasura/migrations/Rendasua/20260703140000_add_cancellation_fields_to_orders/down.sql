ALTER TABLE stripe_refunds
  DROP CONSTRAINT IF EXISTS fk_stripe_refunds_order;

ALTER TABLE orders
  DROP COLUMN IF EXISTS cancellation_notes,
  DROP COLUMN IF EXISTS cancellation_reason_id,
  DROP COLUMN IF EXISTS cancelled_by,
  DROP COLUMN IF EXISTS cancelled_at;
