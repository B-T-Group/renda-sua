-- Stripe manual capture: extend payment transaction and order tracking columns.

ALTER TABLE public.stripe_payment_transactions
    ADD COLUMN IF NOT EXISTS capture_method VARCHAR(10) NOT NULL DEFAULT 'automatic',
    ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS authorization_expires_at TIMESTAMPTZ;

ALTER TABLE public.stripe_payment_transactions
    DROP CONSTRAINT IF EXISTS stripe_payment_transactions_status_check;

ALTER TABLE public.stripe_payment_transactions
    ADD CONSTRAINT stripe_payment_transactions_status_check
    CHECK (
        status IN (
            'pending',
            'authorized',
            'capture_pending',
            'success',
            'failed',
            'cancelled',
            'expired',
            'refunded',
            'disputed'
        )
    );

ALTER TABLE public.stripe_payment_transactions
    DROP CONSTRAINT IF EXISTS stripe_payment_transactions_capture_method_check;

ALTER TABLE public.stripe_payment_transactions
    ADD CONSTRAINT stripe_payment_transactions_capture_method_check
    CHECK (capture_method IN ('automatic', 'manual'));

CREATE INDEX IF NOT EXISTS idx_stripe_payment_transactions_entity_status
    ON public.stripe_payment_transactions(payment_entity, entity_id, status);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_authorized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_captured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
    ON public.orders(stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;
