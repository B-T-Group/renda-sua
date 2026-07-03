CREATE TABLE stripe_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_refund_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_payment_transaction_id UUID REFERENCES stripe_payment_transactions(id),
  order_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason VARCHAR(50),
  failure_reason TEXT,
  cancellation_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  cancelled_by VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stripe_refunds_order_id ON stripe_refunds(order_id);
CREATE INDEX idx_stripe_refunds_stripe_refund_id ON stripe_refunds(stripe_refund_id);
CREATE INDEX idx_stripe_refunds_stripe_payment_intent_id ON stripe_refunds(stripe_payment_intent_id);
CREATE INDEX idx_stripe_refunds_status ON stripe_refunds(status);

COMMENT ON TABLE stripe_refunds IS 'Tracks Stripe refunds initiated for order cancellations';
COMMENT ON COLUMN stripe_refunds.stripe_refund_id IS 'Stripe refund ID from the Refunds API';
COMMENT ON COLUMN stripe_refunds.stripe_payment_intent_id IS 'Payment Intent ID that was refunded';
COMMENT ON COLUMN stripe_refunds.status IS 'Refund status: pending, succeeded, failed, cancelled';
COMMENT ON COLUMN stripe_refunds.cancelled_by IS 'Who cancelled the order: client or business';
