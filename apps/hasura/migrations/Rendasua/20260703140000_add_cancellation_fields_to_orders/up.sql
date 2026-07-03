-- Add cancellation tracking fields to orders table
ALTER TABLE orders
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN cancelled_by VARCHAR(20),
  ADD COLUMN cancellation_reason_id INTEGER REFERENCES order_cancellation_reasons(id),
  ADD COLUMN cancellation_notes TEXT;

COMMENT ON COLUMN orders.cancelled_at IS 'Timestamp when the order was cancelled';
COMMENT ON COLUMN orders.cancelled_by IS 'Who cancelled: client, business, agent, or system';
COMMENT ON COLUMN orders.cancellation_reason_id IS 'Structured reason from order_cancellation_reasons lookup table';
COMMENT ON COLUMN orders.cancellation_notes IS 'Free-text cancellation notes (for "other" reason or additional context)';

-- Add FK constraint from stripe_refunds to orders (was missing)
ALTER TABLE stripe_refunds
  ADD CONSTRAINT fk_stripe_refunds_order
  FOREIGN KEY (order_id) REFERENCES orders(id);
